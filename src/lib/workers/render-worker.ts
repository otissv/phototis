// Render Worker for WebGL operations using OffscreenCanvas
// This worker handles all GPU-intensive operations to prevent main thread blocking

import type { Layer } from "@/layer-system/layer-system"
import type { ImageEditorToolsState } from "@/lib/state.image-editor"
import type { PipelineStage } from "@/lib/shaders/asynchronous-pipeline"
import { AsynchronousPipeline } from "@/lib/shaders/asynchronous-pipeline"
import { HybridRenderer } from "@/lib/shaders/hybrid-renderer"
import { ShaderManager } from "@/lib/shaders"
import {
  validateImageDimensions,
  validateFilterParameters,
} from "@/lib/security/gpu-security"

// Security constants for GPU memory protection
const MAX_TEXTURE_SIZE = 16384 // Maximum WebGL texture size
const MAX_BLUR_KERNEL_SIZE = 256 // Maximum blur kernel size to prevent GPU memory issues
const MAX_CANVAS_DIMENSION = 8192 // Maximum canvas dimension for safety

// Worker message types
interface WorkerMessage {
  type: string
  id: string
  data?: any
}

interface InitializeMessage extends WorkerMessage {
  type: "initialize"
  data: {
    canvas: OffscreenCanvas
    width: number
    height: number
  }
}

interface RenderMessage extends WorkerMessage {
  type: "render"
  data: {
    layers: Layer[]
    toolsValues: ImageEditorToolsState
    selectedLayerId: string
    canvasWidth: number
    canvasHeight: number
    layerDimensions: [
      string,
      { width: number; height: number; x: number; y: number },
    ][]
    token?: { signature?: string; version?: number }
    interactive?: boolean
  }
}

interface FilterMessage extends WorkerMessage {
  type: "applyFilter"
  data: {
    layerId: string
    filterType: string
    parameters: any
    imageData: ImageBitmap
  }
}

interface ProgressMessage {
  type: "progress"
  id: string
  progress: number
}

interface ErrorMessage {
  type: "error"
  id: string
  error: string
}

interface SuccessMessage {
  type: "success"
  id: string
  data?: any
}

// WebGL context and resources
let gl: WebGL2RenderingContext | null = null
let canvas: OffscreenCanvas | null = null
let asynchronousPipeline: AsynchronousPipeline | null = null
let shaderManager: ShaderManager | null = null
let hybridRendererInstance: HybridRenderer | null = null
// Enable pipeline path; progressive rendering will render when final texture ready
const USE_PIPELINE = true
let currentRenderMessageId: string | null = null
const pipelineTaskToWorkerId = new Map<string, string>()
const familyToTokenVersion = new Map<string, number>()
const familyToTokenSignature = new Map<string, string>()
let latestTokenVersion = 0
let latestTokenSignature = ""

// Simple blit program resources (fullscreen textured quad)
let blitProgram: WebGLProgram | null = null
let blitVAO: WebGLVertexArrayObject | null = null
let blitPositionBuffer: WebGLBuffer | null = null
let blitTexCoordBuffer: WebGLBuffer | null = null
let blitUTexLocation: WebGLUniformLocation | null = null
let blitUOpacityLocation: WebGLUniformLocation | null = null

// Compositing program with blend modes
let compProgram: WebGLProgram | null = null
let compVAO: WebGLVertexArrayObject | null = null
let compPositionBuffer: WebGLBuffer | null = null
let compTexCoordBuffer: WebGLBuffer | null = null
let compUBaseLocation: WebGLUniformLocation | null = null
let compUTopLocation: WebGLUniformLocation | null = null
let compUOpacityLocation: WebGLUniformLocation | null = null
let compUBlendModeLocation: WebGLUniformLocation | null = null

// Texture cache
const textureCache = new Map<string, WebGLTexture>()
const textureSignatures = new Map<string, string>()
const lastUsedFrame = new Map<string, number>()
// Use const and mutate through object property to satisfy linter
const frameCounterRef = { value: 0 }

// Debug counters
let dbgCreatedTextures = 0
let dbgDeletedTextures = 0
let dbgCreatedFbos = 0
let dbgDeletedFbos = 0
let dbgTexUploads = 0
let dbgBitmapsCreated = 0
let dbgBitmapsClosed = 0

// Persistent compositing targets (ping/pong). We reuse these across frames to
// avoid constant create/delete churn when compositing layers of the same size.
type CompTarget = {
  tex: WebGLTexture
  fb: WebGLFramebuffer
  width: number
  height: number
}
let compPingTarget: CompTarget | null = null
let compPongTarget: CompTarget | null = null
// FBO pool for reuse (LRU)
const fboPool: Map<string, CompTarget[]> = new Map()
const fboPoolLRU: Map<string, number> = new Map()
let fboPoolFrameCounter = 0
const MAX_FBO_POOL = 8
// Dedicated VAO/buffers for layer filtering with ShaderManager
let layerVAO: WebGLVertexArrayObject | null = null
let layerPositionBuffer: WebGLBuffer | null = null
let layerTexCoordBuffer: WebGLBuffer | null = null

function createCompTarget(width: number, height: number): CompTarget {
  const glCtx = gl as WebGL2RenderingContext
  const tex = glCtx.createTexture()
  if (!tex) throw new Error("Failed to create comp texture")
  glCtx.bindTexture(glCtx.TEXTURE_2D, tex)
  glCtx.texParameteri(
    glCtx.TEXTURE_2D,
    glCtx.TEXTURE_WRAP_S,
    glCtx.CLAMP_TO_EDGE
  )
  glCtx.texParameteri(
    glCtx.TEXTURE_2D,
    glCtx.TEXTURE_WRAP_T,
    glCtx.CLAMP_TO_EDGE
  )
  glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MIN_FILTER, glCtx.LINEAR)
  glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MAG_FILTER, glCtx.LINEAR)
  glCtx.texImage2D(
    glCtx.TEXTURE_2D,
    0,
    glCtx.RGBA,
    width,
    height,
    0,
    glCtx.RGBA,
    glCtx.UNSIGNED_BYTE,
    null
  )
  const fb = glCtx.createFramebuffer()
  if (!fb) throw new Error("Failed to create comp framebuffer")
  glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, fb)
  glCtx.framebufferTexture2D(
    glCtx.FRAMEBUFFER,
    glCtx.COLOR_ATTACHMENT0,
    glCtx.TEXTURE_2D,
    tex,
    0
  )
  dbgCreatedTextures++
  dbgCreatedFbos++
  return { tex, fb, width, height }
}

function ensureCompTarget(
  target: CompTarget | null,
  width: number,
  height: number
): CompTarget {
  const glCtx = gl as WebGL2RenderingContext
  if (!target) {
    return createCompTarget(width, height)
  }
  if (target.width !== width || target.height !== height) {
    // Reallocate the existing texture to the new size; framebuffer remains valid
    glCtx.bindTexture(glCtx.TEXTURE_2D, target.tex)
    glCtx.texImage2D(
      glCtx.TEXTURE_2D,
      0,
      glCtx.RGBA,
      width,
      height,
      0,
      glCtx.RGBA,
      glCtx.UNSIGNED_BYTE,
      null
    )
    target.width = width
    target.height = height
  }
  return target
}

function poolKey(width: number, height: number): string {
  return `${width}x${height}`
}

function checkoutCompTarget(width: number, height: number): CompTarget {
  const key = poolKey(width, height)
  const arr = fboPool.get(key)
  if (arr && arr.length > 0) {
    const target = arr.pop() as CompTarget
    fboPoolLRU.set(key, ++fboPoolFrameCounter)
    return target
  }
  const target = createCompTarget(width, height)
  fboPoolLRU.set(key, ++fboPoolFrameCounter)
  return target
}

function returnCompTarget(target: CompTarget): void {
  const key = poolKey(target.width, target.height)
  const arr = fboPool.get(key) || []
  arr.push(target)
  fboPool.set(key, arr)
  fboPoolLRU.set(key, ++fboPoolFrameCounter)
  // Evict if pool too large
  let total = 0
  fboPool.forEach((a) => {
    total += a.length
  })
  if (total > MAX_FBO_POOL) {
    // Remove least-recently-used bucket entry
    const entries = Array.from(fboPoolLRU.entries()).sort((a, b) => a[1] - b[1])
    for (const [k] of entries) {
      const list = fboPool.get(k)
      if (list && list.length > 0) {
        const victim = list.shift() as CompTarget
        const glCtx = gl as WebGL2RenderingContext
        glCtx.deleteFramebuffer(victim.fb)
        glCtx.deleteTexture(victim.tex)
        dbgDeletedFbos++
        if (list.length === 0) {
          fboPool.delete(k)
          fboPoolLRU.delete(k)
        }
        break
      }
    }
  }
}

function createShader(
  glCtx: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = glCtx.createShader(type)
  if (!shader) throw new Error("Failed to create shader")
  glCtx.shaderSource(shader, source)
  glCtx.compileShader(shader)
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    const info =
      glCtx.getShaderInfoLog(shader) || "Unknown shader compile error"
    glCtx.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

function initCompositingResources(glCtx: WebGL2RenderingContext): void {
  const vs = `#version 300 es\n
in vec2 a_position;\n
in vec2 a_texCoord;\n
out vec2 v_texCoord;\n
void main(){\n
  v_texCoord = a_texCoord;\n
  gl_Position = vec4(a_position, 0.0, 1.0);\n
}`

  const blendGLSL = `
  vec3 rgb2hsl(vec3 c){float maxc=max(max(c.r,c.g),c.b);float minc=min(min(c.r,c.g),c.b);float delta=maxc-minc;vec3 hsl=vec3(0.0,0.0,(maxc+minc)/2.0);if(delta!=0.0){hsl.y=hsl.z<0.5?delta/(maxc+minc):delta/(2.0-maxc-minc);float deltaR=(((maxc-c.r)/6.0)+(delta/2.0))/delta;float deltaG=(((maxc-c.g)/6.0)+(delta/2.0))/delta;float deltaB=(((maxc-c.b)/6.0)+(delta/2.0))/delta;if(c.r==maxc){hsl.x=deltaB-deltaG;}else if(c.g==maxc){hsl.x=(1.0/3.0)+deltaR-deltaB;}else{hsl.x=(2.0/3.0)+deltaG-deltaR;}if(hsl.x<0.0)hsl.x+=1.0; if(hsl.x>1.0)hsl.x-=1.0;}return hsl;}
  vec3 hsl2rgb(vec3 c){vec3 rgb=clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0*c.z - 1.0));}
  vec4 blendNormal(vec4 base, vec4 top){float a=top.a+base.a*(1.0-top.a);if(a<0.001) return vec4(0.0);vec3 r=(top.rgb*top.a+base.rgb*base.a*(1.0-top.a))/a;return vec4(r,a);} 
  vec4 blendMultiply(vec4 base, vec4 top){vec3 m=base.rgb*top.rgb;float a=top.a+base.a*(1.0-top.a);if(a<0.001) return vec4(0.0);vec3 r=(m*top.a+base.rgb*base.a*(1.0-top.a))/a;return vec4(r,a);} 
  vec4 blendScreen(vec4 base, vec4 top){vec3 s=1.0-(1.0-base.rgb)*(1.0-top.rgb);float a=top.a+base.a*(1.0-top.a);if(a<0.001) return vec4(0.0);vec3 r=(s*top.a+base.rgb*base.a*(1.0-top.a))/a;return vec4(r,a);} 
  vec4 applyBlendMode(vec4 base, vec4 top, int m){if(m==0) return blendNormal(base,top); if(m==1) return blendMultiply(base,top); if(m==2) return blendScreen(base,top); return blendNormal(base,top);} 
  `

  const fs = `#version 300 es\n
precision highp float;\n
in vec2 v_texCoord;\n
uniform sampler2D u_baseTexture;\n
uniform sampler2D u_topTexture;\n
uniform float u_opacity;\n
uniform int u_blendMode;\n
out vec4 outColor;\n
${blendGLSL}\n
void main(){\n
  vec2 uv = v_texCoord;\n
  vec4 baseColor = texture(u_baseTexture, uv);\n
  vec4 topColor = texture(u_topTexture, uv);\n
  topColor.a *= u_opacity;\n
  outColor = applyBlendMode(baseColor, topColor, u_blendMode);\n
}`

  compProgram = createProgram(glCtx, vs, fs)
  compUBaseLocation = glCtx.getUniformLocation(compProgram, "u_baseTexture")
  compUTopLocation = glCtx.getUniformLocation(compProgram, "u_topTexture")
  compUOpacityLocation = glCtx.getUniformLocation(compProgram, "u_opacity")
  compUBlendModeLocation = glCtx.getUniformLocation(compProgram, "u_blendMode")

  compVAO = glCtx.createVertexArray()
  if (!compVAO) throw new Error("Failed to create compositing VAO")
  glCtx.bindVertexArray(compVAO)

  compPositionBuffer = glCtx.createBuffer()
  if (!compPositionBuffer)
    throw new Error("Failed to create compositing position buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, compPositionBuffer)
  glCtx.bufferData(
    glCtx.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    glCtx.STATIC_DRAW
  )
  const aPosLoc = glCtx.getAttribLocation(compProgram, "a_position")
  glCtx.enableVertexAttribArray(aPosLoc)
  glCtx.vertexAttribPointer(aPosLoc, 2, glCtx.FLOAT, false, 0, 0)

  compTexCoordBuffer = glCtx.createBuffer()
  if (!compTexCoordBuffer)
    throw new Error("Failed to create compositing texcoord buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, compTexCoordBuffer)
  glCtx.bufferData(
    glCtx.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    glCtx.STATIC_DRAW
  )
  const aTexLoc = glCtx.getAttribLocation(compProgram, "a_texCoord")
  glCtx.enableVertexAttribArray(aTexLoc)
  glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

  glCtx.bindVertexArray(null)
}

const BLEND_MODE_CODE: Record<string, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
}

function createProgram(
  glCtx: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = createShader(glCtx, glCtx.VERTEX_SHADER, vsSource)
  const fs = createShader(glCtx, glCtx.FRAGMENT_SHADER, fsSource)
  const program = glCtx.createProgram()
  if (!program) throw new Error("Failed to create program")
  glCtx.attachShader(program, vs)
  glCtx.attachShader(program, fs)
  glCtx.linkProgram(program)
  glCtx.deleteShader(vs)
  glCtx.deleteShader(fs)
  if (!glCtx.getProgramParameter(program, glCtx.LINK_STATUS)) {
    const info =
      glCtx.getProgramInfoLog(program) || "Unknown program link error"
    glCtx.deleteProgram(program)
    throw new Error(info)
  }
  return program
}

function initBlitResources(glCtx: WebGL2RenderingContext): void {
  // Vertex and fragment shaders for a simple textured quad
  const vs = `#version 300 es\n
in vec2 a_position;\n
in vec2 a_texCoord;\n
out vec2 v_texCoord;\n
void main() {\n
  v_texCoord = a_texCoord;\n
  gl_Position = vec4(a_position, 0.0, 1.0);\n
}`
  const fs = `#version 300 es\n
precision highp float;\n
in vec2 v_texCoord;\n
uniform sampler2D u_texture;\n
uniform float u_opacity;\n
out vec4 outColor;\n
void main() {\n
  // Use texture coordinates directly since we've corrected them in the buffer
  vec2 uv = v_texCoord;\n
  vec4 c = texture(u_texture, uv);\n
  c.a *= u_opacity;\n
  outColor = c;\n
}`

  blitProgram = createProgram(glCtx, vs, fs)
  blitUTexLocation = glCtx.getUniformLocation(blitProgram, "u_texture")
  blitUOpacityLocation = glCtx.getUniformLocation(blitProgram, "u_opacity")

  // Create buffers and VAO
  blitVAO = glCtx.createVertexArray()
  if (!blitVAO) throw new Error("Failed to create VAO")
  glCtx.bindVertexArray(blitVAO)

  // Fullscreen quad positions (triangle strip)
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  blitPositionBuffer = glCtx.createBuffer()
  if (!blitPositionBuffer) throw new Error("Failed to create position buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, blitPositionBuffer)
  glCtx.bufferData(glCtx.ARRAY_BUFFER, positions, glCtx.STATIC_DRAW)

  const aPosLoc = glCtx.getAttribLocation(blitProgram, "a_position")
  glCtx.enableVertexAttribArray(aPosLoc)
  glCtx.vertexAttribPointer(aPosLoc, 2, glCtx.FLOAT, false, 0, 0)

  // Texture coordinates
  const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
  blitTexCoordBuffer = glCtx.createBuffer()
  if (!blitTexCoordBuffer) throw new Error("Failed to create texcoord buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, blitTexCoordBuffer)
  glCtx.bufferData(glCtx.ARRAY_BUFFER, texCoords, glCtx.STATIC_DRAW)

  const aTexLoc = glCtx.getAttribLocation(blitProgram, "a_texCoord")
  glCtx.enableVertexAttribArray(aTexLoc)
  glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

  // Unbind VAO
  glCtx.bindVertexArray(null)
}

// Security validation helper
function validateBlurKernelSize(size: number): number {
  return Math.max(1, Math.min(size, MAX_BLUR_KERNEL_SIZE))
}

// Initialize WebGL context with OffscreenCanvas
function initializeWebGL(
  offscreenCanvas: OffscreenCanvas,
  width: number,
  height: number
): boolean {
  try {
    // Validate dimensions
    const dimValidation = validateImageDimensions(width, height)
    if (!dimValidation.isValid) {
      throw new Error(
        dimValidation.error || `Invalid canvas dimensions: ${width}x${height}`
      )
    }

    canvas = offscreenCanvas

    // Get WebGL2 context with appropriate options
    gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: true,
      powerPreference: "high-performance",
    })

    if (!gl) {
      throw new Error("WebGL2 not supported in worker")
    }

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Configure WebGL
    gl.viewport(0, 0, width, height)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    // Initialize blit and compositing resources
    initBlitResources(gl)
    initCompositingResources(gl)

    // Initialize shared shader manager for layer filters
    shaderManager = new ShaderManager()
    shaderManager.initialize(gl)
    // Build VAO for layer rendering
    layerVAO = gl.createVertexArray()
    if (!layerVAO) throw new Error("Failed to create layer VAO")
    gl.bindVertexArray(layerVAO)
    // Position buffer
    layerPositionBuffer = gl.createBuffer()
    if (!layerPositionBuffer)
      throw new Error("Failed to create layer position buffer")
    gl.bindBuffer(gl.ARRAY_BUFFER, layerPositionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    // Texcoord buffer
    layerTexCoordBuffer = gl.createBuffer()
    if (!layerTexCoordBuffer)
      throw new Error("Failed to create layer texcoord buffer")
    gl.bindBuffer(gl.ARRAY_BUFFER, layerTexCoordBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    gl.bindVertexArray(null)

    // Initialize HybridRenderer instance for fallback path
    hybridRendererInstance = new HybridRenderer()
    hybridRendererInstance.initialize({ gl, width, height })

    // Initialize asynchronous pipeline
    asynchronousPipeline = new AsynchronousPipeline({
      enableProgressiveRendering: true,
      maxConcurrentStages: 2,
      enableMemoryMonitoring: true,
      frameTimeTargetMs: 16.7,
    })
    // Bridge events to main thread with the current worker message ID
    asynchronousPipeline.setEventEmitter({
      onProgress: (
        taskId: string,
        progress: number,
        stage: PipelineStage,
        data?: any
      ) => {
        const original = data?.originalTaskId as string | undefined
        // Drop stale: if this task family predates the latest token, ignore
        if (original) {
          const famVer = familyToTokenVersion.get(original) ?? 0
          if (famVer < latestTokenVersion) return
        }
        const workerId =
          (original && pipelineTaskToWorkerId.get(original)) ||
          pipelineTaskToWorkerId.get(taskId) ||
          currentRenderMessageId
        if (workerId) {
          postMessage({
            type: "progress",
            id: workerId,
            progress,
          } as ProgressMessage)
        }
      },
      onSuccess: async (taskId: string, result: any) => {
        const original = result?.originalTaskId as string | undefined
        if (original) {
          const famVer = familyToTokenVersion.get(original) ?? 0
          if (famVer < latestTokenVersion) return
        }
        const workerId =
          pipelineTaskToWorkerId.get(taskId) || currentRenderMessageId
        try {
          if (result?.finalTexture && canvas) {
            await renderToCanvas(
              result.finalTexture,
              canvas.width,
              canvas.height
            )
          }
        } finally {
          if (workerId) {
            postMessage({ type: "success", id: workerId } as SuccessMessage)
          }
          // Clean mapping entries that point to this worker task id
          try {
            for (const [k, v] of Array.from(pipelineTaskToWorkerId.entries())) {
              if (v === workerId) pipelineTaskToWorkerId.delete(k)
            }
          } catch {}
        }
      },
      onError: (taskId: string, error: string) => {
        // Allow errors only for current family
        const famVer = latestTokenVersion
        const workerId =
          pipelineTaskToWorkerId.get(taskId) || currentRenderMessageId
        if (workerId) {
          postMessage({ type: "error", id: workerId, error } as ErrorMessage)
        }
        // Clean mapping for this task/worker association
        try {
          if (workerId) {
            for (const [k, v] of Array.from(pipelineTaskToWorkerId.entries())) {
              if (v === workerId || k === taskId)
                pipelineTaskToWorkerId.delete(k)
            }
          } else {
            pipelineTaskToWorkerId.delete(taskId)
          }
        } catch {}
      },
    })
    asynchronousPipeline.initialize({ gl, width, height })

    return true
  } catch (error) {
    console.error("Failed to initialize WebGL in worker:", error)
    return false
  }
}

// Render layers with progressive quality
async function renderLayers(
  layers: Layer[],
  toolsValues: ImageEditorToolsState,
  selectedLayerId: string,
  canvasWidth: number,
  canvasHeight: number,
  layerDimensions: [
    string,
    { width: number; height: number; x: number; y: number },
  ][],
  messageId: string
): Promise<void> {
  try {
    // Remove cached textures for layers that no longer exist to avoid leaking GPU memory
    const aliveIds = new Set(layers.map((l) => l.id))
    for (const [key, tex] of Array.from(textureCache.entries())) {
      if (!aliveIds.has(key)) {
        try {
          ;(gl as WebGL2RenderingContext).deleteTexture(tex)
          dbgDeletedTextures++
        } catch {}
        textureCache.delete(key)
        textureSignatures.delete(key)
      }
    }
    if (!gl) {
      throw new Error("WebGL context not initialized")
    }

    // Convert layerDimensions array to Map for easier access
    const layerDimensionsMap = new Map(layerDimensions)

    // Validate canvas dimensions
    const canvasDim = validateImageDimensions(canvasWidth, canvasHeight)
    if (!canvasDim.isValid) {
      throw new Error(
        canvasDim.error ||
          `Invalid canvas dimensions: ${canvasWidth}x${canvasHeight}`
      )
    }

    // Send progress update
    postMessage({
      type: "progress",
      id: messageId,
      progress: 10,
    } as ProgressMessage)

    // Stage 0: Token-based stale-task drop (if provided)
    if ((self as any).__lastToken) {
      const prev = (self as any).__lastToken as {
        signature?: string
        version?: number
      }
      const current =
        (currentRenderMessageId && (self as any).__currentToken) || null
      // no-op; we replace token below
    }

    // Stage 0b: preempt progressive pipeline tasks from older families
    if (USE_PIPELINE && asynchronousPipeline) {
      try {
        // Cancel all existing families; new render supersedes
        asynchronousPipeline.cancelAll()
      } catch {}
    }

    // Stage 1: Layer preprocessing and texture preparation
    const layerTextures = new Map<string, WebGLTexture>()

    frameCounterRef.value++
    for (const layer of layers) {
      // Validate layer dimensions
      const layerDim = layerDimensionsMap.get(layer.id)
      if (layerDim) {
        const v = validateImageDimensions(layerDim.width, layerDim.height)
        if (!v.isValid) {
          console.warn(`Skipping layer ${layer.id} with invalid dimensions`)
          continue
        }
      }

      // Load and validate layer texture
      if (layer.image) {
        try {
          const texture = await loadLayerTexture(layer)
          if (texture) {
            layerTextures.set(layer.id, texture)
            lastUsedFrame.set(layer.id, frameCounterRef.value)
          }
        } catch (error) {
          console.warn(`Failed to load texture for layer ${layer.id}:`, error)
        }
      }
    }

    postMessage({
      type: "progress",
      id: messageId,
      progress: 30,
    } as ProgressMessage)

    // Stage 2: Individual layer rendering with filters
    const renderedLayers = new Map<string, WebGLTexture>()

    for (const layer of layers) {
      const layerTexture = layerTextures.get(layer.id)
      if (!layerTexture) continue

      // Validate filter parameters
      const layerToolsValues =
        layer.id === selectedLayerId ? toolsValues : layer.filters
      const { validatedParameters: validatedToolsValues } =
        validateFilterParameters(layerToolsValues)

      try {
        // Render layer with filters
        const renderedTexture = await renderLayerWithFilters(
          layer,
          layerTexture,
          validatedToolsValues,
          canvasWidth,
          canvasHeight,
          layerDimensions
        )

        if (renderedTexture) {
          renderedLayers.set(layer.id, renderedTexture)
        }
      } catch (error) {
        console.warn(`Failed to render layer ${layer.id}:`, error)
      }
    }

    postMessage({
      type: "progress",
      id: messageId,
      progress: 60,
    } as ProgressMessage)

    // Stage 3: Layer compositing and blending (shader-based)
    let finalTexture: WebGLTexture | null = null
    let drewAnyLayer = false
    if (renderedLayers.size > 0) {
      // Ensure persistent ping/pong comp targets sized to current canvas
      compPingTarget = ensureCompTarget(
        compPingTarget,
        canvasWidth,
        canvasHeight
      )
      compPongTarget = ensureCompTarget(
        compPongTarget,
        canvasWidth,
        canvasHeight
      )
      // Local handles for this render pass
      const ping: CompTarget = compPingTarget as CompTarget
      const pong: CompTarget = compPongTarget as CompTarget
      let writeTarget: CompTarget = ping
      try {
        if (
          !compProgram ||
          !compVAO ||
          !compUBaseLocation ||
          !compUTopLocation
        ) {
          // If custom compositing resources fail, attempt HybridRenderer path
          if (hybridRendererInstance) {
            // Build textures map for hybrid renderer
            const layerTexMap = new Map<string, WebGLTexture>()
            for (const [id, tex] of renderedLayers) layerTexMap.set(id, tex)
            // Use renderer to compose
            const orderedLayers = layers.slice().reverse()
            hybridRendererInstance.renderLayers(
              orderedLayers,
              layerTexMap,
              toolsValues,
              selectedLayerId,
              canvasWidth,
              canvasHeight
            )
            const result = (hybridRendererInstance as any).fboManager?.getFBO?.(
              "result"
            )
            finalTexture = result?.texture || null
            drewAnyLayer = !!finalTexture
            if (drewAnyLayer && finalTexture) {
              await renderToCanvas(finalTexture, canvasWidth, canvasHeight)
            }
            throw new Error("HYBRID_FALLBACK_USED")
          }
          throw new Error("Compositing resources not initialized")
        }

        // Targets are ready via ensureCompTarget above
        let readTexture: WebGLTexture | null = null

        // Clear first target
        {
          const glCtx = gl as WebGL2RenderingContext
          glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, writeTarget.fb)
          glCtx.viewport(0, 0, canvasWidth, canvasHeight)
          glCtx.clearColor(0, 0, 0, 0)
          glCtx.clear(glCtx.COLOR_BUFFER_BIT)
        }

        // Ordered draw bottom->top.
        // The editor currently provides layers in top-first order (new layers are unshifted),
        // so convert to bottom->top for correct compositing.
        const orderedLayers = layers.slice().reverse()
        for (const layer of orderedLayers) {
          const tex = renderedLayers.get(layer.id)
          if (layer.visible === false || layer.opacity <= 0) continue
          // Mark as used this frame
          lastUsedFrame.set(layer.id, frameCounterRef.value)

          if (!readTexture) {
            // First visible layer must be an image layer to establish a base
            if (!tex) {
              // Skip non-image (e.g., adjustment) layers until we have a base
              continue
            }
            // First visible image layer: blit to writeTarget
            if (!blitProgram || !blitVAO || !blitUTexLocation) {
              throw new Error("Blit resources not initialized")
            }
            const glCtx = gl as WebGL2RenderingContext
            glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, writeTarget.fb)
            glCtx.useProgram(blitProgram)
            glCtx.bindVertexArray(blitVAO)
            glCtx.activeTexture(glCtx.TEXTURE0)
            glCtx.bindTexture(glCtx.TEXTURE_2D, tex)
            glCtx.uniform1i(blitUTexLocation as WebGLUniformLocation, 0)
            if (blitUOpacityLocation) {
              glCtx.uniform1f(
                blitUOpacityLocation,
                Math.max(0, Math.min(1, layer.opacity / 100))
              )
            }
            glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
            glCtx.bindVertexArray(null)
            glCtx.useProgram(null)
            readTexture = writeTarget.tex
            drewAnyLayer = true
            continue
          }

          // We have an accumulated base in readTexture
          // If current layer is an adjustment layer (no tex), render adjusted top from base
          let topTexture: WebGLTexture | null = tex || null
          if (!topTexture && (layer as any).type === "adjustment") {
            topTexture = await renderAdjustmentFromBase(
              readTexture,
              (layer as any).parameters || {},
              canvasWidth,
              canvasHeight
            )
          }
          if (!topTexture) {
            // Nothing to composite for this layer
            continue
          }

          // Composite current layer over accumulated result into the opposite target
          const output: CompTarget = writeTarget === ping ? pong : ping
          {
            const glCtx = gl as WebGL2RenderingContext
            glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, output.fb)
            glCtx.viewport(0, 0, canvasWidth, canvasHeight)
            glCtx.clearColor(0, 0, 0, 0)
            glCtx.clear(glCtx.COLOR_BUFFER_BIT)

            glCtx.useProgram(compProgram)
            glCtx.bindVertexArray(compVAO)

            glCtx.activeTexture(glCtx.TEXTURE0)
            glCtx.bindTexture(glCtx.TEXTURE_2D, readTexture)
            glCtx.uniform1i(compUBaseLocation as WebGLUniformLocation, 0)

            glCtx.activeTexture(glCtx.TEXTURE1)
            glCtx.bindTexture(glCtx.TEXTURE_2D, topTexture)
            glCtx.uniform1i(compUTopLocation as WebGLUniformLocation, 1)

            if (compUOpacityLocation)
              glCtx.uniform1f(
                compUOpacityLocation,
                Math.max(0, Math.min(1, layer.opacity / 100))
              )

            const mode =
              (layer as any).blendModeCode ??
              BLEND_MODE_CODE[(layer as any).blendMode] ??
              0
            if (compUBlendModeLocation)
              glCtx.uniform1i(compUBlendModeLocation, mode)

            glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
            glCtx.bindVertexArray(null)
            glCtx.useProgram(null)
          }

          // Swap
          writeTarget = output
          readTexture = writeTarget.tex
        }

        finalTexture = readTexture

        // Render final to canvas
        if (drewAnyLayer && finalTexture) {
          await renderToCanvas(finalTexture, canvasWidth, canvasHeight)
        }
      } catch (error) {
        console.error("Failed to composite layers (blend shader):", error)
      } finally {
        // Unbind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      }
    }

    postMessage({
      type: "progress",
      id: messageId,
      progress: 90,
      dbg: {
        createdTextures: dbgCreatedTextures,
        deletedTextures: dbgDeletedTextures,
        createdFbos: dbgCreatedFbos,
        deletedFbos: dbgDeletedFbos,
        texUploads: dbgTexUploads,
        bitmapsCreated: dbgBitmapsCreated,
        bitmapsClosed: dbgBitmapsClosed,
        cacheSize: textureCache.size,
        numInputLayers: layers.length,
        numPreparedTextures: layerTextures.size,
        numRenderedLayers: renderedLayers.size,
        fboPoolBuckets: Array.from(fboPool.keys()).length,
        fboPoolItems: Array.from(fboPool.values()).reduce(
          (a, b) => a + b.length,
          0
        ),
      },
    } as any)

    // Try pipeline path for progressive rendering (with tokening/preemption)
    if (USE_PIPELINE && asynchronousPipeline) {
      try {
        // Associate token for stale drop and schedule all levels
        const baseTaskId = await asynchronousPipeline.queueRenderTask(
          layers,
          toolsValues,
          selectedLayerId,
          canvasWidth,
          canvasHeight,
          layerDimensionsMap,
          1
        )
        // Map pipeline base task to current worker message ID
        pipelineTaskToWorkerId.set(baseTaskId, messageId)
        familyToTokenVersion.set(baseTaskId, latestTokenVersion)
        familyToTokenSignature.set(baseTaskId, latestTokenSignature)
        // Pipeline will emit progress/success which will finalize rendering
        return
      } catch (e) {
        console.warn(
          "Pipeline queue failed, falling back to immediate draw:",
          e
        )
      }
    }

    // Stage 4: Final output generation (skip if we already drew to default fb)
    if (drewAnyLayer) {
      // Already rendered to canvas; just notify success
      postMessage({ type: "success", id: messageId } as SuccessMessage)
      return
    }

    // No layers visible: clear to transparent and notify
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    postMessage({ type: "success", id: messageId } as SuccessMessage)

    postMessage({
      type: "success",
      id: messageId,
    } as SuccessMessage)
  } catch (error) {
    console.error("Rendering failed:", error)
    postMessage({
      type: "error",
      id: messageId,
      error: error instanceof Error ? error.message : "Unknown error",
    } as ErrorMessage)
  }

  // Opportunistic LRU-style cleanup: delete textures not used in the last 120 frames
  try {
    const threshold = Math.max(0, frameCounterRef.value - 120)
    for (const [key, tex] of Array.from(textureCache.entries())) {
      const last = lastUsedFrame.get(key) ?? 0
      if (last < threshold) {
        ;(gl as WebGL2RenderingContext).deleteTexture(tex)
        dbgDeletedTextures++
        textureCache.delete(key)
        textureSignatures.delete(key)
        lastUsedFrame.delete(key)
      }
    }

    // Additional cleanup: limit cache size to prevent unbounded growth
    const maxCacheSize = 50 // Maximum number of cached textures
    if (textureCache.size > maxCacheSize) {
      // Remove oldest entries beyond the limit
      const sortedEntries = Array.from(lastUsedFrame.entries()).sort(
        (a, b) => a[1] - b[1]
      ) // Sort by frame number (oldest first)

      const entriesToRemove = sortedEntries.slice(
        0,
        textureCache.size - maxCacheSize
      )
      for (const [key] of entriesToRemove) {
        const tex = textureCache.get(key)
        if (tex) {
          ;(gl as WebGL2RenderingContext).deleteTexture(tex)
          dbgDeletedTextures++
          textureCache.delete(key)
          textureSignatures.delete(key)
          lastUsedFrame.delete(key)
        }
      }
    }
  } catch {}
}

// Load layer texture with validation
async function loadLayerTexture(layer: Layer): Promise<WebGLTexture | null> {
  if (!gl) return null

  try {
    if (!layer.image) return null

    // Basic signature for cache invalidation
    const signature: string | undefined = (layer as any).imageSignature
    const cacheKey = `${layer.id}`
    const existingSig = textureSignatures.get(cacheKey)
    if (signature && existingSig === signature) {
      const cached = textureCache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    // Create texture
    const texture = gl.createTexture()
    if (!texture) return null

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // Use nearest initially to avoid unintended smoothing; pipeline can choose
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    let imageBitmap: ImageBitmap

    // Handle both ImageBitmap and Blob/File objects. Avoid fragile instanceof checks across realms.
    const imgAny: any = (layer as any).image
    const isImageBitmapLike =
      imgAny &&
      typeof imgAny === "object" &&
      "width" in imgAny &&
      "height" in imgAny &&
      (typeof imgAny.close === "function" ||
        typeof (self as any).ImageBitmap !== "undefined")

    const isBlobLike =
      imgAny &&
      typeof imgAny === "object" &&
      typeof imgAny.arrayBuffer === "function" &&
      typeof imgAny.size === "number" &&
      typeof imgAny.type === "string"

    if (
      isImageBitmapLike &&
      (imgAny as ImageBitmap).width &&
      (imgAny as ImageBitmap).height
    ) {
      imageBitmap = imgAny as ImageBitmap
    } else if (isBlobLike) {
      // Convert Blob/File to ImageBitmap respecting EXIF orientation
      imageBitmap = await createImageBitmap(imgAny as Blob, {
        imageOrientation: "from-image",
      })
      dbgBitmapsCreated++
    } else {
      console.warn("Unsupported image type for layer:", layer.id)
      return null
    }

    // Validate dimensions
    if (!validateImageDimensions(imageBitmap.width, imageBitmap.height)) {
      throw new Error(
        `Invalid image dimensions: ${imageBitmap.width}x${imageBitmap.height}`
      )
    }

    // Upload to GPU
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imageBitmap
    )
    dbgTexUploads++

    // Once uploaded to GPU, the bitmap can be closed to free memory
    if (typeof (imageBitmap as any).close === "function") {
      try {
        ;(imageBitmap as any).close()
        dbgBitmapsClosed++
      } catch {}
    }

    // Cache texture
    textureCache.set(cacheKey, texture)
    if (signature) textureSignatures.set(cacheKey, signature)
    return texture
  } catch (error) {
    console.error("Failed to load layer texture:", error)
    return null
  }
}

// Render layer with filters
async function renderLayerWithFilters(
  layer: Layer,
  layerTexture: WebGLTexture,
  toolsValues: ImageEditorToolsState,
  canvasWidth: number,
  canvasHeight: number,
  layerDimensions: [
    string,
    { width: number; height: number; x: number; y: number },
  ][]
): Promise<WebGLTexture | null> {
  if (!gl || !shaderManager) return null

  try {
    const glCtx = gl as WebGL2RenderingContext
    const program = shaderManager.getProgram()
    if (!program) return layerTexture

    glCtx.useProgram(program)
    // Bind attributes
    if (!layerVAO || !layerPositionBuffer || !layerTexCoordBuffer)
      return layerTexture
    glCtx.bindVertexArray(layerVAO)
    const aPosLoc = glCtx.getAttribLocation(program, "a_position")
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, layerPositionBuffer)
    glCtx.enableVertexAttribArray(aPosLoc)
    glCtx.vertexAttribPointer(aPosLoc, 2, glCtx.FLOAT, false, 0, 0)
    const aTexLoc = glCtx.getAttribLocation(program, "a_texCoord")
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, layerTexCoordBuffer)
    glCtx.enableVertexAttribArray(aTexLoc)
    glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

    // Texture and uniforms
    glCtx.activeTexture(glCtx.TEXTURE0)
    glCtx.bindTexture(glCtx.TEXTURE_2D, layerTexture)
    const uSampler = glCtx.getUniformLocation(program, "u_image")
    if (uSampler) glCtx.uniform1i(uSampler, 0)

    const { validatedParameters } = validateFilterParameters(toolsValues)
    shaderManager.updateUniforms(validatedParameters)
    shaderManager.setUniforms(glCtx, program)

    // Draw to a comp target to avoid feedback
    const ping = ensureCompTarget(compPingTarget, canvasWidth, canvasHeight)
    compPingTarget = ping
    glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, ping.fb)
    glCtx.viewport(0, 0, canvasWidth, canvasHeight)
    glCtx.clearColor(0, 0, 0, 0)
    glCtx.clear(glCtx.COLOR_BUFFER_BIT)
    glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)

    // Cleanup binds
    glCtx.bindVertexArray(null)
    glCtx.useProgram(null)
    glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, null)

    return ping.tex
  } catch (error) {
    console.error("Failed to render layer with filters:", error)
    return null
  }
}

// Render an adjustment pass by applying given parameters to the base texture
async function renderAdjustmentFromBase(
  baseTexture: WebGLTexture,
  parameters: Record<string, number | { value: number; color: string }>,
  canvasWidth: number,
  canvasHeight: number
): Promise<WebGLTexture | null> {
  if (!gl || !shaderManager) return null

  try {
    const glCtx = gl as WebGL2RenderingContext
    const program = shaderManager.getProgram()
    if (!program) return null

    // Validate parameters
    const { validatedParameters } = validateFilterParameters(parameters as any)

    glCtx.useProgram(program)
    if (!layerVAO || !layerPositionBuffer || !layerTexCoordBuffer) return null
    glCtx.bindVertexArray(layerVAO)

    const aPosLoc = glCtx.getAttribLocation(program, "a_position")
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, layerPositionBuffer)
    glCtx.enableVertexAttribArray(aPosLoc)
    glCtx.vertexAttribPointer(aPosLoc, 2, glCtx.FLOAT, false, 0, 0)

    const aTexLoc = glCtx.getAttribLocation(program, "a_texCoord")
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, layerTexCoordBuffer)
    glCtx.enableVertexAttribArray(aTexLoc)
    glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

    glCtx.activeTexture(glCtx.TEXTURE0)
    glCtx.bindTexture(glCtx.TEXTURE_2D, baseTexture)
    const uSampler = glCtx.getUniformLocation(program, "u_image")
    if (uSampler) glCtx.uniform1i(uSampler, 0)

    // Update shader uniforms; enforce full opacity in this pass
    shaderManager.updateUniforms({
      ...(validatedParameters as any),
      u_opacity: 100,
    })
    shaderManager.setUniforms(glCtx, program)

    // Draw into a pooled comp target
    const target = checkoutCompTarget(canvasWidth, canvasHeight)
    glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, target.fb)
    glCtx.viewport(0, 0, canvasWidth, canvasHeight)
    glCtx.clearColor(0, 0, 0, 0)
    glCtx.clear(glCtx.COLOR_BUFFER_BIT)
    glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)

    glCtx.bindVertexArray(null)
    glCtx.useProgram(null)
    glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, null)

    // Return texture and put FBO back to pool (keep texture with it)
    // We cannot detach texture from framebuffer; keep both until next pool use
    return target.tex
  } catch (error) {
    console.error("Failed to render adjustment from base:", error)
    return null
  }
}

// Composite layers
async function compositeLayers(
  layerTextures: [string, WebGLTexture][],
  canvasWidth: number,
  canvasHeight: number
): Promise<WebGLTexture | null> {
  if (!gl) return null

  try {
    // For now, just return the first layer texture
    // TODO: Implement actual layer compositing using shaders

    return layerTextures[0]?.[1] || null
  } catch (error) {
    console.error("Failed to composite layers:", error)
    return null
  }
}

// Render final result to canvas
async function renderToCanvas(
  finalTexture: WebGLTexture,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  if (!gl) return

  try {
    // Bind default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasWidth, canvasHeight)

    // Clear canvas
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Use blit program to draw the texture to the canvas
    if (!blitProgram || !blitVAO || !blitUTexLocation) {
      throw new Error("Blit resources not initialized")
    }

    gl.useProgram(blitProgram)
    gl.bindVertexArray(blitVAO)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, finalTexture)
    gl.uniform1i(blitUTexLocation, 0)

    // Ensure full opacity for visibility
    if (blitUOpacityLocation) {
      gl.uniform1f(blitUOpacityLocation, 1.0)
    }

    gl.disable(gl.BLEND)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindVertexArray(null)
    gl.useProgram(null)
  } catch (error) {
    console.error("Failed to render to canvas:", error)
  }
}

// Message handler
self.onmessage = async (event: MessageEvent) => {
  const message: WorkerMessage = event.data

  try {
    switch (message.type) {
      case "initialize": {
        const initMessage = message as InitializeMessage

        try {
          const success = initializeWebGL(
            initMessage.data.canvas,
            initMessage.data.width,
            initMessage.data.height
          )

          postMessage({
            type: success ? "success" : "error",
            id: message.id,
            error: success ? undefined : "Failed to initialize WebGL",
          } as SuccessMessage | ErrorMessage)
        } catch (error) {
          console.error("Worker initialization error:", error)
          postMessage({
            type: "error",
            id: message.id,
            error:
              error instanceof Error
                ? error.message
                : "Unknown initialization error",
          } as ErrorMessage)
        }
        break
      }

      case "render": {
        const renderMessage = message as RenderMessage
        currentRenderMessageId = message.id
        // Update latest token
        const token = renderMessage.data.token || { signature: "", version: 0 }
        latestTokenVersion = Math.max(latestTokenVersion, token.version || 0)
        latestTokenSignature = token.signature || latestTokenSignature

        if (
          asynchronousPipeline &&
          typeof renderMessage.data.interactive === "boolean"
        ) {
          asynchronousPipeline.setInteractive(!!renderMessage.data.interactive)
        }

        await renderLayers(
          renderMessage.data.layers,
          renderMessage.data.toolsValues,
          renderMessage.data.selectedLayerId,
          renderMessage.data.canvasWidth,
          renderMessage.data.canvasHeight,
          renderMessage.data.layerDimensions,
          message.id
        )
        break
      }

      case "applyFilter": {
        const filterMessage = message as FilterMessage
        // Apply specific filter to layer
        // This will be implemented for individual filter operations
        postMessage({
          type: "success",
          id: message.id,
        } as SuccessMessage)
        break
      }

      default:
        postMessage({
          type: "error",
          id: message.id,
          error: `Unknown message type: ${message.type}`,
        } as ErrorMessage)
    }
  } catch (error) {
    postMessage({
      type: "error",
      id: message.id,
      error: error instanceof Error ? error.message : "Unknown error",
    } as ErrorMessage)
  }
}

// Cleanup function
function cleanup(): void {
  if (gl) {
    // Clean up cached textures
    try {
      for (const tex of textureCache.values()) {
        ;(gl as WebGL2RenderingContext).deleteTexture(tex)
      }
      textureCache.clear()
      textureSignatures.clear()
    } catch {}
    // Clean up persistent comp targets
    try {
      const glCtx = gl as WebGL2RenderingContext
      if (compPingTarget) {
        glCtx.deleteFramebuffer(compPingTarget.fb)
        glCtx.deleteTexture(compPingTarget.tex)
        dbgDeletedFbos++
        dbgDeletedTextures++
        compPingTarget = null
      }
      if (compPongTarget) {
        glCtx.deleteFramebuffer(compPongTarget.fb)
        glCtx.deleteTexture(compPongTarget.tex)
        dbgDeletedFbos++
        dbgDeletedTextures++
        compPongTarget = null
      }
    } catch {}
    gl = null
  }

  // Clean up blit resources
  if (canvas && blitProgram && (canvas as any)) {
    // Best-effort cleanup
  }
  // Note: gl may be null already; guard on gl first
  const glCtx = gl as WebGL2RenderingContext | null
  if (glCtx) {
    if (blitProgram) {
      glCtx.deleteProgram(blitProgram)
    }
    if (blitPositionBuffer) {
      glCtx.deleteBuffer(blitPositionBuffer)
    }
    if (blitTexCoordBuffer) {
      glCtx.deleteBuffer(blitTexCoordBuffer)
    }
    if (blitVAO) {
      glCtx.deleteVertexArray(blitVAO)
    }
  }
  blitProgram = null
  blitVAO = null
  blitPositionBuffer = null
  blitTexCoordBuffer = null
  blitUTexLocation = null

  // if (hybridRenderer) {
  //   // hybridRenderer.cleanup()
  //   hybridRenderer = null
  // }

  canvas = null
}

// Handle worker termination
self.onclose = () => {
  cleanup()
}
