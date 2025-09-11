// Render Worker for WebGL operations using OffscreenCanvas
// This worker handles all GPU-intensive operations to prevent main thread blocking

import type { EditorLayer } from "@/lib/editor/state"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import type { PipelineStage } from "@/lib/shaders/asynchronous-pipeline"
import type { HybridRenderer } from "@/lib/shaders/hybrid-renderer"
import { ShaderManagerV2 } from "@/lib/shaders/v2/manager"
import { GlobalShaderRegistryV2 } from "@/lib/shaders/v2/registry"
import { registerBuiltinShaders } from "@/lib/shaders/v2/builtins"
import { FBOManager } from "@/lib/shaders/fbo-manager"
import { WorkerPassGraphPipeline } from "@/lib/shaders/v2/pipeline.worker"
import { RenderConfig } from "@/lib/shaders/render-config"
import {
  BLEND_MODE_MAP,
  BLEND_MODE_GLSL,
} from "@/lib/shaders/blend-modes/blend-modes"
import type { BlendMode } from "@/lib/shaders/blend-modes/types.blend"
import {
  validateImageDimensions,
  validateFilterParameters,
} from "@/lib/security/gpu-security"

import { GPU_SECURITY_CONSTANTS } from "@/lib/security/gpu-security"

const { MAX_BLUR_KERNEL_SIZE } = GPU_SECURITY_CONSTANTS

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
    layers: EditorLayer[]
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
    colorSpace?: number
    graph?: any
  }
}

interface ResizeMessage extends WorkerMessage {
  type: "resize"
  data: {
    width: number
    height: number
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
let shaderManagerV2: ShaderManagerV2 | null = null
let shaderRegistryVersion = 0
let passGraphPipeline: WorkerPassGraphPipeline | null = null
let fboManagerPG: FBOManager | null = null
let pgPositionBuffer: WebGLBuffer | null = null
let pgCompTexcoordBuffer: WebGLBuffer | null = null
let docColorSpaceFlag = 0 // 0: sRGB, 1: linear, 2: display-p3 (placeholder)
const maskTextures: Map<string, WebGLTexture> = new Map()

function computeTransformMat3(
  scale: number,
  rotateDeg: number,
  flipH: boolean,
  flipV: boolean,
  translateX = 0,
  translateY = 0
): number[] {
  const r = (rotateDeg * Math.PI) / 180
  const cs = Math.cos(r)
  const sn = Math.sin(r)
  const sx = scale * (flipH ? -1 : 1)
  const sy = scale * (flipV ? -1 : 1)
  const m00 = cs * sx
  const m01 = -sn * sy
  const m02 = translateX
  const m10 = sn * sx
  const m11 = cs * sy
  const m12 = translateY
  return [m00, m01, m02, m10, m11, m12, 0, 0, 1]
}
let canvas: OffscreenCanvas | null = null
let asynchronousPipeline: any | null = null
const shaderManager: any | null = null // Legacy - will be removed
let hybridRendererInstance: HybridRenderer | null = null
// Enable pipeline path; progressive rendering will render when final texture ready
// Temporarily disable pipeline and hybrid renderer paths to debug first-frame strip issue
const USE_PIPELINE = true
const USE_HYBRID_RENDERER = true
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
// Debug ID maps for textures and FBOs
const __texIds = new WeakMap<WebGLTexture, number>()
const __fbIds = new WeakMap<WebGLFramebuffer, number>()
let __idCounter = 1
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
// Debug helper
function dbg(stage: string, extra?: any) {
  try {
    ;(self as any).postMessage({ type: "debug", stage, t: Date.now(), extra })
  } catch {}
  try {
    // Also log directly from the worker so it's visible even if forwarding fails
    ;(self as any).console?.debug?.("worker-dbg", {
      stage,
      t: Date.now(),
      extra,
    })
  } catch {}
}
// Ensure no texture unit is bound to the destination texture (prevents feedback)
function unbindTextureFromAllUnits(
  glCtx: WebGL2RenderingContext,
  texture: WebGLTexture | null
): void {
  if (!texture) return
  let maxUnits = 8
  try {
    maxUnits = glCtx.getParameter(glCtx.MAX_TEXTURE_IMAGE_UNITS) as number
  } catch {}
  for (let i = 0; i < maxUnits; i++) {
    glCtx.activeTexture(glCtx.TEXTURE0 + i)
    try {
      const bound = glCtx.getParameter(
        glCtx.TEXTURE_BINDING_2D
      ) as WebGLTexture | null
      if (bound === texture) {
        glCtx.bindTexture(glCtx.TEXTURE_2D, null)
      }
    } catch {}
  }
}
// Helper: blit a texture directly to a framebuffer using WebGL2 blitFramebuffer
function blitTextureToFramebuffer(
  glCtx: WebGL2RenderingContext,
  srcTexture: WebGLTexture,
  dstFramebuffer: WebGLFramebuffer,
  width: number,
  height: number
): void {
  // Create transient FBO to attach the source texture for READ_FRAMEBUFFER
  const srcFbo = glCtx.createFramebuffer()
  if (!srcFbo) throw new Error("Failed to create temp framebuffer for blit")
  glCtx.bindFramebuffer(glCtx.READ_FRAMEBUFFER, srcFbo)
  glCtx.framebufferTexture2D(
    glCtx.READ_FRAMEBUFFER,
    glCtx.COLOR_ATTACHMENT0,
    glCtx.TEXTURE_2D,
    srcTexture,
    0
  )

  // Bind the destination framebuffer for DRAW_FRAMEBUFFER
  glCtx.bindFramebuffer(glCtx.DRAW_FRAMEBUFFER, dstFramebuffer)

  // Perform the blit copy (no shader sampling, avoids feedback hazards)
  glCtx.blitFramebuffer(
    0,
    0,
    width,
    height,
    0,
    0,
    width,
    height,
    glCtx.COLOR_BUFFER_BIT,
    glCtx.NEAREST
  )

  // Cleanup: unbind and delete temp FBO, restore bindings
  glCtx.bindFramebuffer(glCtx.READ_FRAMEBUFFER, null)
  glCtx.bindFramebuffer(glCtx.DRAW_FRAMEBUFFER, null)
  glCtx.deleteFramebuffer(srcFbo)
}
// Heavy init flags
let heavyInitStarted = false
let heavyInitDone = false

function createCompTarget(width: number, height: number): CompTarget {
  const glCtx = gl as WebGL2RenderingContext
  const tex = glCtx.createTexture()
  if (!tex) throw new Error("Failed to create comp texture")
  __texIds.set(tex, __idCounter++)
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
  __fbIds.set(fb, __idCounter++)
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

  // Use the blend mode GLSL from blend-modes.ts for consistency
  const blendGLSL = BLEND_MODE_GLSL

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
}\n`

  try {
    compProgram = createProgram(glCtx, vs, fs)
    dbg("compositing:program:created", { success: !!compProgram })
  } catch (error) {
    dbg("compositing:program:error", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
  compUBaseLocation = glCtx.getUniformLocation(compProgram, "u_baseTexture")
  compUTopLocation = glCtx.getUniformLocation(compProgram, "u_topTexture")
  compUOpacityLocation = glCtx.getUniformLocation(compProgram, "u_opacity")
  compUBlendModeLocation = glCtx.getUniformLocation(compProgram, "u_blendMode")

  // Debug: Check if all uniforms were found
  try {
    dbg("compositing:uniforms", {
      base: !!compUBaseLocation,
      top: !!compUTopLocation,
      opacity: !!compUOpacityLocation,
      blendMode: !!compUBlendModeLocation,
      program: !!compProgram,
      vao: !!compVAO,
    })
  } catch {}

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
  // Compositing samples FBOs produced by layer passes; those are upright. Use normal V.
  const compTexCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
  glCtx.bufferData(glCtx.ARRAY_BUFFER, compTexCoords, glCtx.STATIC_DRAW)

  // Debug: Log compositing shader texture coordinates
  try {
    dbg("compositing:texcoords", {
      coords: Array.from(compTexCoords),
      description:
        "compositing shader texture coordinates (normal; sampling upright FBOs)",
      unpackFlipY: glCtx.getParameter(glCtx.UNPACK_FLIP_Y_WEBGL),
    })
  } catch {}
  const aTexLoc = glCtx.getAttribLocation(compProgram, "a_texCoord")
  glCtx.enableVertexAttribArray(aTexLoc)
  glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

  glCtx.bindVertexArray(null)
}

// Use the full BLEND_MODE_MAP from blend-modes.ts for consistency
const BLEND_MODE_CODE = BLEND_MODE_MAP

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
  // a_position is already in clip space for this full-canvas blit
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

  // Fullscreen quad positions (triangle strip) in clip-space
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  blitPositionBuffer = glCtx.createBuffer()
  if (!blitPositionBuffer) throw new Error("Failed to create position buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, blitPositionBuffer)
  glCtx.bufferData(glCtx.ARRAY_BUFFER, positions, glCtx.STATIC_DRAW)

  const aPosLoc = glCtx.getAttribLocation(blitProgram, "a_position")
  glCtx.enableVertexAttribArray(aPosLoc)
  glCtx.vertexAttribPointer(aPosLoc, 2, glCtx.FLOAT, false, 0, 0)

  // Final blit samples the final composed FBO which is upright; use normal V
  const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
  blitTexCoordBuffer = glCtx.createBuffer()
  if (!blitTexCoordBuffer) throw new Error("Failed to create texcoord buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, blitTexCoordBuffer)
  glCtx.bufferData(glCtx.ARRAY_BUFFER, texCoords, glCtx.STATIC_DRAW)

  // Debug: Log blit shader texture coordinates
  try {
    dbg("blit:texcoords", {
      coords: Array.from(texCoords),
      description:
        "blit shader texture coordinates (normal; sampling upright final texture)",
      unpackFlipY: glCtx.getParameter(glCtx.UNPACK_FLIP_Y_WEBGL),
    })
  } catch {}

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
    dbg("initialize:received", { width, height })
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
      antialias: false, // Disable MSAA to avoid multisampled default framebuffer (blit incompatibility)
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
    // Configure WebGL with centralized settings
    RenderConfig.configureWebGL(gl)
    dbg("gl:configured")

    // Debug: confirm OffscreenCanvas size vs requested
    try {
      dbg("initialize:size", {
        requestedWidth: width,
        requestedHeight: height,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      })
    } catch {}

    // Initialize v2 shader manager in worker mode (after GL is ready)
    try {
      registerBuiltinShaders(GlobalShaderRegistryV2)
      shaderManagerV2 = new ShaderManagerV2(GlobalShaderRegistryV2)
      shaderManagerV2.initialize(gl as WebGL2RenderingContext, "worker")
      shaderRegistryVersion = GlobalShaderRegistryV2.getVersion()
      // Build pass-graph essentials
      fboManagerPG = new FBOManager()
      fboManagerPG.initialize(gl as WebGL2RenderingContext)
      passGraphPipeline = new WorkerPassGraphPipeline(
        gl as WebGL2RenderingContext,
        fboManagerPG,
        shaderManagerV2
      )
      // Simple position and comp texcoord buffers
      pgPositionBuffer = (gl as WebGL2RenderingContext).createBuffer()
      if (pgPositionBuffer) {
        ;(gl as WebGL2RenderingContext).bindBuffer(
          (gl as WebGL2RenderingContext).ARRAY_BUFFER,
          pgPositionBuffer
        )
        ;(gl as WebGL2RenderingContext).bufferData(
          (gl as WebGL2RenderingContext).ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          (gl as WebGL2RenderingContext).STATIC_DRAW
        )
      }
      pgCompTexcoordBuffer = RenderConfig.createCompTexCoordBuffer(
        gl as WebGL2RenderingContext
      )
      dbg("shader:v2:init", { version: shaderRegistryVersion })
    } catch {}

    dbg("initialize:complete")
    return true
  } catch (error) {
    console.error("Failed to initialize WebGL in worker:", error)
    return false
  }
}

async function ensureHeavyInit(width: number, height: number): Promise<void> {
  if (heavyInitDone) return
  if (!gl) throw new Error("WebGL context not initialized")
  if (heavyInitStarted) return
  heavyInitStarted = true
  const glCtx = gl as WebGL2RenderingContext
  // Lazy-load heavy modules at first render to avoid blocking initialize
  dbg("heavy:init:start")
  const t0 = Date.now()
  const [hybridMod, pipelineMod] = await Promise.all([
    import("@/lib/shaders/hybrid-renderer"),
    import("@/lib/shaders/asynchronous-pipeline"),
  ])
  dbg("heavy:imports:end", { dt: Date.now() - t0 })
  // Initialize blit and compositing resources
  initBlitResources(glCtx)
  initCompositingResources(glCtx)

  // Initialize v2 shader manager for layer filters
  shaderManagerV2 = new ShaderManagerV2(GlobalShaderRegistryV2)
  shaderManagerV2.initialize(glCtx, "worker")
  registerBuiltinShaders()
  // Build VAO for layer rendering
  layerVAO = glCtx.createVertexArray()
  if (!layerVAO) throw new Error("Failed to create layer VAO")
  glCtx.bindVertexArray(layerVAO)
  // Position buffer
  layerPositionBuffer = glCtx.createBuffer()
  if (!layerPositionBuffer)
    throw new Error("Failed to create layer position buffer")
  glCtx.bindBuffer(glCtx.ARRAY_BUFFER, layerPositionBuffer)
  glCtx.bufferData(
    glCtx.ARRAY_BUFFER,
    // Vertex shader expects 0..1 layer-local quad, not clip-space
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    glCtx.STATIC_DRAW
  )
  // Texcoord buffer
  layerTexCoordBuffer = RenderConfig.createLayerTexCoordBuffer(glCtx)

  // Debug: Log layer rendering texture coordinates
  try {
    dbg("layer:texcoords", {
      coords: Array.from(RenderConfig.LAYER_TEXCOORDS),
      description:
        "layer rendering texture coordinates (normal V, UNPACK_FLIP_Y_WEBGL=false)",
      unpackFlipY: glCtx.getParameter(glCtx.UNPACK_FLIP_Y_WEBGL),
    })
  } catch {}
  glCtx.bindVertexArray(null)

  // Initialize HybridRenderer instance for fallback path
  const HybridRendererCtor = hybridMod.HybridRenderer
  hybridRendererInstance = new HybridRendererCtor()
  hybridRendererInstance.initialize({
    gl: glCtx,
    width,
    height,
  })

  // Initialize asynchronous pipeline
  const AsynchronousPipelineCtor = pipelineMod.AsynchronousPipeline as any
  asynchronousPipeline = new AsynchronousPipelineCtor({
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
            (canvas as OffscreenCanvas).width,
            (canvas as OffscreenCanvas).height
          )
        }
      } finally {
        if (workerId) {
          postMessage({ type: "success", id: workerId } as SuccessMessage)
        }
        try {
          for (const [k, v] of Array.from(pipelineTaskToWorkerId.entries())) {
            if (v === workerId) pipelineTaskToWorkerId.delete(k)
          }
        } catch {}
      }
    },
    onError: (taskId: string, error: string) => {
      const workerId =
        pipelineTaskToWorkerId.get(taskId) || currentRenderMessageId
      if (workerId) {
        postMessage({ type: "error", id: workerId, error } as ErrorMessage)
      }
      try {
        if (workerId) {
          for (const [k, v] of Array.from(pipelineTaskToWorkerId.entries())) {
            if (v === workerId || k === taskId) pipelineTaskToWorkerId.delete(k)
          }
        } else {
          pipelineTaskToWorkerId.delete(taskId)
        }
      } catch {}
    },
  })
  asynchronousPipeline.initialize({
    gl: glCtx,
    width,
    height,
  })
  dbg("heavy:init:done")
  heavyInitDone = true
}

// Helper to safely get layer dimensions from tuple array
function getLayerDims(
  list: [string, { width: number; height: number; x: number; y: number }][],
  id: string
): { x: number; y: number; width: number; height: number } | null {
  try {
    for (let i = 0; i < list.length; i++) {
      const entry = list[i]
      if (Array.isArray(entry) && entry.length === 2) {
        const key = entry[0]
        const val = entry[1] as any
        if (key === id && val && typeof val.width === "number") {
          return {
            x: Number(val.x) || 0,
            y: Number(val.y) || 0,
            width: Math.max(0, Number(val.width) || 0),
            height: Math.max(0, Number(val.height) || 0),
          }
        }
      }
    }
  } catch {}
  return null
}

// Flatten grouped layers into a single array for rendering
// This function recursively processes group layers and their children,
// respecting the visible state and maintaining proper z-order
function flattenLayersForRendering(layers: EditorLayer[]): EditorLayer[] {
  const flattened: EditorLayer[] = []

  for (const layer of layers) {
    if (layer.type === "group") {
      const groupLayer = layer as any

      // Only skip group children if the group itself is not visible
      // collapsed is a UI-only state and should not affect rendering
      if (!groupLayer.visible) {
        continue
      }

      // Add group children in order (they're already in the correct z-order)
      if (Array.isArray(groupLayer.children)) {
        for (const child of groupLayer.children) {
          // Recursively flatten nested groups
          if (child.type === "group") {
            flattened.push(...flattenLayersForRendering([child]))
          } else {
            flattened.push(child)
          }
        }
      }
    } else {
      // Non-group layers are added directly
      flattened.push(layer)
    }
  }

  return flattened
}

// Render layers with progressive quality
async function renderLayers(
  layers: EditorLayer[],
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
    // Early abort if this message was superseded by a newer render request
    try {
      if (currentRenderMessageId && messageId !== currentRenderMessageId) {
        postMessage({ type: "success", id: messageId } as SuccessMessage)
        return
      }
    } catch {}

    // Ensure heavy GPU resources are prepared lazily
    await ensureHeavyInit(canvasWidth, canvasHeight)

    // Stage 1: Collect all layer IDs (including group children) for texture cleanup
    const allLayerIds = new Set<string>()
    const collectLayerIds = (layers: EditorLayer[]) => {
      for (const layer of layers) {
        allLayerIds.add(layer.id)
        if (layer.type === "group") {
          const groupLayer = layer as any
          if (Array.isArray(groupLayer.children)) {
            collectLayerIds(groupLayer.children)
          }
        }
      }
    }
    collectLayerIds(layers)

    // Remove cached textures for layers that no longer exist to avoid leaking GPU memory
    const aliveIds = allLayerIds
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

    // Update color space flag if provided in message data
    try {
      const m: any = (self as any).__lastMessageData
      if (m && typeof m.colorSpace === "number")
        docColorSpaceFlag = m.colorSpace
    } catch {}

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

    // Token-based stale-task drop for immediate path (not only pipeline)
    // If a newer token was observed, abort this render early
    try {
      const famVer = latestTokenVersion
      const famSig = latestTokenSignature
      if (
        famVer &&
        currentRenderMessageId &&
        messageId !== currentRenderMessageId
      ) {
        // This message was superseded by a more recent render request
        postMessage({ type: "success", id: messageId } as SuccessMessage)
        return
      }
      // Optional: check signature mismatch as well when provided downstream
      if (famSig && currentRenderMessageId === messageId) {
        // ok
      }
    } catch {}

    // Stage 0b: preempt progressive pipeline tasks from older families
    if (USE_PIPELINE && asynchronousPipeline) {
      try {
        // Cancel all existing families; new render supersedes
        asynchronousPipeline.cancelAll()
      } catch {}
    }

    // Stage 2: Layer preprocessing and texture preparation
    const layerTextures = new Map<string, WebGLTexture>()

    frameCounterRef.value++

    // Load textures recursively for all layers including group children
    const loadTexturesRecursively = async (layers: EditorLayer[]) => {
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
        if (layer.type === "image" && layer.image) {
          try {
            const texture = await loadLayerTexture(layer)
            if (texture) {
              layerTextures.set(layer.id, texture)
              lastUsedFrame.set(layer.id, frameCounterRef.value)
            }
          } catch (error) {
            console.warn(`Failed to load texture for layer ${layer.id}:`, error)
          }
        } else if (layer.type === "group") {
          // Recursively load textures for group children
          const groupLayer = layer as any
          if (Array.isArray(groupLayer.children)) {
            await loadTexturesRecursively(groupLayer.children)
          }
        }
        // Load mask texture if available on layer (supports ImageBitmap, Blob/File, ArrayBuffer)
        try {
          const anyLayer: any = layer as any
          const mask = anyLayer?.mask
          if (mask?.image) {
            const key = `${layer.id}:mask`
            if (!maskTextures.has(key)) {
              const glCtx = gl as WebGL2RenderingContext
              const tex = glCtx.createTexture()
              if (tex) {
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
                glCtx.texParameteri(
                  glCtx.TEXTURE_2D,
                  glCtx.TEXTURE_MIN_FILTER,
                  glCtx.LINEAR
                )
                glCtx.texParameteri(
                  glCtx.TEXTURE_2D,
                  glCtx.TEXTURE_MAG_FILTER,
                  glCtx.LINEAR
                )
                let bitmap: ImageBitmap | null = null
                try {
                  const src: any = mask.image
                  const isBitmapLike =
                    src &&
                    typeof src === "object" &&
                    "width" in src &&
                    "height" in src
                  const isBlobLike =
                    src &&
                    typeof src.size === "number" &&
                    typeof src.type === "string"
                  const isArrayBuffer =
                    src && (src as ArrayBuffer).byteLength !== undefined
                  if (isBitmapLike) {
                    bitmap = src as ImageBitmap
                  } else if (isBlobLike) {
                    bitmap = await createImageBitmap(src as Blob, {
                      imageOrientation: "from-image",
                    })
                  } else if (isArrayBuffer) {
                    const blob = new Blob([src as ArrayBuffer])
                    bitmap = await createImageBitmap(blob, {
                      imageOrientation: "from-image",
                    })
                  }
                } catch {}
                if (bitmap) {
                  glCtx.texImage2D(
                    glCtx.TEXTURE_2D,
                    0,
                    glCtx.RGBA,
                    glCtx.RGBA,
                    glCtx.UNSIGNED_BYTE,
                    bitmap
                  )
                  try {
                    if (typeof (bitmap as any).close === "function")
                      (bitmap as any).close()
                  } catch {}
                }
                maskTextures.set(key, tex)
                glCtx.bindTexture(glCtx.TEXTURE_2D, null)
              }
            }
          }
        } catch {}
      }
    }

    await loadTexturesRecursively(layers)

    postMessage({
      type: "progress",
      id: messageId,
      progress: 30,
    } as ProgressMessage)

    // Prefer HybridRenderer path for correct transforms and clipping (prevents edge bleed)
    if (
      USE_HYBRID_RENDERER &&
      hybridRendererInstance &&
      layerTextures.size > 0
    ) {
      try {
        const texMap = new Map<string, WebGLTexture>()
        for (const [id, tex] of layerTextures) texMap.set(id, tex)

        // Pass original layer structure to let hybrid renderer handle groups
        hybridRendererInstance.renderLayers(
          layers as any,
          texMap,
          toolsValues,
          selectedLayerId,
          canvasWidth,
          canvasHeight,
          layerDimensionsMap
        )

        const result = (hybridRendererInstance as any).fboManager?.getFBO?.(
          "result"
        )
        const finalTexture: WebGLTexture | null = result?.texture || null
        if (finalTexture) {
          await renderToCanvas(finalTexture, canvasWidth, canvasHeight)
          postMessage({ type: "success", id: messageId } as SuccessMessage)
          return
        }
      } catch (error) {
        console.error("HybridRenderer worker path failed; falling back", error)
      }
    }

    // Stage 3: Individual layer rendering with filters
    const renderedLayers = new Map<string, WebGLTexture>()

    // Debug: Log layer rendering start
    try {
      dbg("layers:render-start", {
        totalLayers: layers.length,
        layerIds: layers.map((l) => l.id),
        layerOrder: layers.map((l, i) => ({
          index: i,
          id: l.id,
          type: (l as any).type,
          visible: l.visible,
          opacity: l.opacity,
        })),
      })
    } catch {}

    // Render layers recursively including group children
    const renderLayersRecursively = async (layers: EditorLayer[]) => {
      for (const layer of layers) {
        const layerTexture = layerTextures.get(layer.id)
        if (!layerTexture) continue

        // Validate filter parameters
        const layerToolsValues =
          layer.id === selectedLayerId
            ? toolsValues
            : layer.type === "image"
              ? layer.filters
              : toolsValues
        try {
          dbg("layer:tools-source", {
            layerId: layer.id,
            source:
              layer.id === selectedLayerId
                ? "selected-global"
                : layer.type === "image"
                  ? "layer.filters"
                  : "global",
            flipH: Boolean((layerToolsValues as any)?.flipHorizontal),
            flipV: Boolean((layerToolsValues as any)?.flipVertical),
            rotate: Number((layerToolsValues as any)?.rotate || 0),
          })
        } catch {}

        const { validatedParameters: validatedToolsValues } =
          validateFilterParameters(layerToolsValues)

        try {
          // Debug: Log individual layer rendering
          try {
            dbg("layer:render-start", {
              layerId: layer.id,
              hasTexture: !!layerTexture,
              layerType: (layer as any).type,
              layerIndex: layers.indexOf(layer),
              layerOpacity: layer.opacity,
              layerVisible: layer.visible,
            })
          } catch {}

          // Render layer via v2 pass-graph (IPC-provided or built per layer)
          let renderedTexture: WebGLTexture | null = layerTexture
          if (passGraphPipeline && pgPositionBuffer && pgCompTexcoordBuffer) {
            const p: any = validatedToolsValues
            let layerPasses: any[] = []
            const u_transform = computeTransformMat3(
              Number(p.scale || 1),
              Number(p.rotate || 0),
              Boolean(p.flipHorizontal),
              Boolean(p.flipVertical)
            )
            const baseUniforms = {
              u_colorSpace: docColorSpaceFlag,
              u_transform,
            }
            // Resolve layer dimensions for placement
            const dimEntry = layerDimensionsMap.get(layer.id) as
              | { x: number; y: number; width: number; height: number }
              | undefined
            const lw = dimEntry?.width ?? canvasWidth
            const lh = dimEntry?.height ?? canvasHeight
            const lx = dimEntry?.x ?? 0
            const ly = dimEntry?.y ?? 0
            // Try to consume IPC-sent graph for this layer
            try {
              const lastMsg: any = (self as any).__lastMessageData
              const graph = lastMsg?.graph
              if (Array.isArray(graph)) {
                const entry = graph.find(
                  (g: any) => g && g.layerId === layer.id
                )
                if (entry && Array.isArray(entry.passes)) {
                  layerPasses = entry.passes.map((pp: any) => ({
                    shaderName: String(pp.shaderName || ""),
                    passId: pp.passId ? String(pp.passId) : undefined,
                    variantKey: pp.variantKey
                      ? String(pp.variantKey)
                      : undefined,
                    uniforms: { ...baseUniforms, ...(pp.uniforms || {}) },
                    inputs: Array.isArray(pp.inputs)
                      ? pp.inputs.slice()
                      : undefined,
                  }))
                  // Ensure linearize first and encode last
                  if (layerPasses.length) {
                    if (layerPasses[0].shaderName !== "color.linearize")
                      layerPasses.unshift({
                        shaderName: "color.linearize",
                        uniforms: { ...baseUniforms },
                      })
                    if (
                      layerPasses[layerPasses.length - 1].shaderName !==
                      "color.encode"
                    )
                      layerPasses.push({
                        shaderName: "color.encode",
                        uniforms: { ...baseUniforms },
                      })
                  }
                }
              }
            } catch {}
            // First, place uploaded bitmap into an FBO with correct orientation
            {
              const out0 = passGraphPipeline.runSingle(
                {
                  shaderName: "layer.render",
                  uniforms: {
                    ...baseUniforms,
                    u_layerSize: [lw, lh],
                    u_canvasSize: [canvasWidth, canvasHeight],
                    u_layerPosition: [lx + lw / 2, ly + lh / 2],
                  },
                  channels: { u_texture: renderedTexture },
                  targetFboName: "temp",
                },
                canvasWidth,
                canvasHeight,
                {
                  position: layerPositionBuffer as WebGLBuffer,
                  texcoord: layerTexCoordBuffer as WebGLBuffer,
                }
              )
              if (out0) renderedTexture = out0
            }

            if (Number(p.blur || 0) > 0) {
              layerPasses.push({
                shaderName: "blur.separable",
                passId: "h",
                uniforms: { ...baseUniforms, u_blur: Number(p.blur) },
                inputs: ["layer.render"],
              })
              layerPasses.push({
                shaderName: "blur.separable",
                passId: "v",
                uniforms: { ...baseUniforms, u_blur: Number(p.blur) },
                inputs: ["h"],
              })
            }
            if (
              Number(p.vintage || 0) > 0 ||
              Number(p.sepia || 0) > 0 ||
              Number(p.grayscale || 0) > 0 ||
              Number(p.invert || 0) > 0
            ) {
              layerPasses.push({
                shaderName: "effects.vintage",
                uniforms: {
                  ...baseUniforms,
                  u_vintage: Number(p.vintage || 0),
                  u_invert: Number(p.invert || 0),
                  u_sepia: Number(p.sepia || 0),
                  u_grayscale: Number(p.grayscale || 0),
                  u_recolor: Number(p.recolor || 0),
                  u_vibrance: Number(p.vibrance || 0),
                  u_noise: Number(p.noise || 0),
                  u_grain: Number(p.grain || 0),
                },
                inputs: [
                  layerPasses[layerPasses.length - 1].passId ||
                    layerPasses[layerPasses.length - 1].shaderName,
                ],
              })
            }
            layerPasses.push({
              shaderName: "adjustments.basic",
              uniforms: {
                ...baseUniforms,
                u_brightness: Number(p.brightness || 100),
                u_contrast: Number(p.contrast || 100),
                u_saturation: Number(p.saturation || 100),
                u_hue: Number(p.hue || 0),
                u_exposure: Number(p.exposure || 0),
                u_gamma: Number(p.gamma || 1),
                u_opacity: 100,
              },
              inputs: [
                layerPasses[layerPasses.length - 1].passId ||
                  layerPasses[layerPasses.length - 1].shaderName,
              ],
            })

            if (layerPasses.length) {
              // Source for the first pass comes from oriented layer texture
              ;(layerPasses[0] as any).channels = { u_texture: renderedTexture }
              const out = passGraphPipeline.runDAG(
                layerPasses,
                canvasWidth,
                canvasHeight,
                // All passes after layer.render sample FBO outputs → comp texcoords
                { position: pgPositionBuffer, texcoord: pgCompTexcoordBuffer }
              )
              if (out) renderedTexture = out
            }
          }

          if (renderedTexture) {
            renderedLayers.set(layer.id, renderedTexture)
            try {
              dbg("layer:render-success", {
                layerId: layer.id,
                hasRenderedTexture: !!renderedTexture,
                layerIndex: layers.indexOf(layer),
              })
            } catch {}
          }
        } catch (error) {
          console.warn(`Failed to render layer ${layer.id}:`, error)
          try {
            dbg("layer:render-error", {
              layerId: layer.id,
              error: error instanceof Error ? error.message : String(error),
              layerIndex: layers.indexOf(layer),
            })
          } catch {}
        }
      }
    }

    await renderLayersRecursively(layers)

    try {
      dbg("layers:rendered", { count: renderedLayers.size })
    } catch {}

    postMessage({
      type: "progress",
      id: messageId,
      progress: 60,
    } as ProgressMessage)

    // Stage 4: Layer compositing and blending (shader-based)
    let finalTexture: WebGLTexture | null = null
    let drewAnyLayer = false
    if (renderedLayers.size > 0) {
      try {
        dbg("composite:start", {
          canvasWidth,
          canvasHeight,
          layerCount: renderedLayers.size,
          layerIds: Array.from(renderedLayers.keys()),
        })
      } catch {}
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
          !compUTopLocation ||
          !compUBlendModeLocation
        ) {
          // If custom compositing resources fail, attempt HybridRenderer path
          if (USE_HYBRID_RENDERER && hybridRendererInstance) {
            // Build textures map for hybrid renderer
            const layerTexMap = new Map<string, WebGLTexture>()
            for (const [id, tex] of renderedLayers) layerTexMap.set(id, tex)
            // Use renderer to compose (let hybrid renderer handle groups)
            hybridRendererInstance.renderLayers(
              layers as any,
              layerTexMap,
              toolsValues,
              selectedLayerId,
              canvasWidth,
              canvasHeight,
              layerDimensionsMap
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

        // Debug: Log compositing order
        try {
          dbg("composite:order", {
            totalLayers: orderedLayers.length,
            layerOrder: orderedLayers.map((l, i) => ({
              index: i,
              id: l.id,
              visible: l.visible,
              opacity: l.opacity,
              hasTexture: !!renderedLayers.get(l.id),
            })),
          })
        } catch {}

        for (const layer of orderedLayers) {
          const tex = renderedLayers.get(layer.id)
          if (layer.visible === false || layer.opacity <= 0) continue
          // Mark as used this frame
          lastUsedFrame.set(layer.id, frameCounterRef.value)

          if (!readTexture) {
            // First visible layer must be an image layer to establish a base
            if (!tex) {
              try {
                dbg("composite:skip", {
                  layerId: layer.id,
                  reason: "no texture (adjustment layer)",
                  layerType: (layer as any).type,
                })
              } catch {}
              // Skip non-image (e.g., adjustment) layers until we have a base
              continue
            }
            try {
              dbg("composite:base", {
                layerId: layer.id,
                layerName: (layer as any).name || null,
                renderingPath: "blit shader (first layer)",
                hasTexture: !!tex,
                layerIndex: orderedLayers.indexOf(layer),
              })
            } catch {}
            // First visible image layer: copy via scratch then blit to destination (avoid any feedback)
            if (!blitProgram || !blitVAO || !blitUTexLocation) {
              throw new Error("Blit resources not initialized")
            }
            const glCtx = gl as WebGL2RenderingContext
            // Copy source texture to an intermediate scratch FBO via framebuffer blit
            const scratchBase = checkoutCompTarget(canvasWidth, canvasHeight)
            try {
              blitTextureToFramebuffer(
                glCtx,
                tex as WebGLTexture,
                scratchBase.fb,
                canvasWidth,
                canvasHeight
              )
              dbg("draw:copy->scratch", {
                fb: __fbIds.get(scratchBase.fb),
                tex0: __texIds.get(tex as WebGLTexture),
                via: "blitFramebuffer",
              })
            } catch (e) {
              console.warn(
                "copy->scratch blit failed, fallback to shader copy",
                e
              )
              glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, scratchBase.fb)
              glCtx.viewport(0, 0, canvasWidth, canvasHeight)
              glCtx.clearColor(0, 0, 0, 0)
              glCtx.clear(glCtx.COLOR_BUFFER_BIT)
              glCtx.useProgram(blitProgram)
              glCtx.bindVertexArray(blitVAO)
              glCtx.activeTexture(glCtx.TEXTURE0)
              glCtx.bindTexture(glCtx.TEXTURE_2D, tex as WebGLTexture)
              glCtx.uniform1i(blitUTexLocation as WebGLUniformLocation, 0)
              if (blitUOpacityLocation)
                glCtx.uniform1f(blitUOpacityLocation, 1.0)
              glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
              glCtx.bindVertexArray(null)
              glCtx.useProgram(null)
            }

            // Now blit from scratch into the writeTarget
            glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, writeTarget.fb)
            glCtx.viewport(0, 0, canvasWidth, canvasHeight)
            glCtx.clearColor(0, 0, 0, 0)
            glCtx.clear(glCtx.COLOR_BUFFER_BIT)
            // Ensure no texture units are bound to the destination texture to avoid feedback
            try {
              unbindTextureFromAllUnits(glCtx, writeTarget.tex)
            } catch {}
            // Use framebuffer-to-framebuffer blit to avoid shader sampling feedback
            try {
              blitTextureToFramebuffer(
                glCtx,
                scratchBase.tex,
                writeTarget.fb,
                canvasWidth,
                canvasHeight
              )
              dbg("draw:base->write", {
                fb: __fbIds.get(writeTarget.fb),
                srcTex: __texIds.get(scratchBase.tex),
                via: "blitFramebuffer",
              })
            } catch (e) {
              console.warn("blitFramebuffer failed, fallback to shader blit", e)
              glCtx.useProgram(blitProgram)
              glCtx.bindVertexArray(blitVAO)
              glCtx.activeTexture(glCtx.TEXTURE0)
              glCtx.bindTexture(glCtx.TEXTURE_2D, scratchBase.tex)
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
            }
            try {
              returnCompTarget(scratchBase)
            } catch {}
            readTexture = writeTarget.tex
            drewAnyLayer = true
            continue
          }

          // We have an accumulated base in readTexture
          // If current layer is an adjustment layer (no tex), render adjusted top from base
          let topTexture: WebGLTexture | null = tex || null
          if (!topTexture && (layer as any).type === "adjustment") {
            // Map UI-level params to shader params via adjustment plugin registry
            try {
              const { mapParametersToShader } = await import(
                "@/lib/editor/adjustments/registry"
              )
              const shaderParams = mapParametersToShader(
                (layer as any).adjustmentType,
                (layer as any).parameters || {}
              ) as Record<string, number | { value: number; color: string }>
              topTexture = await renderAdjustmentFromBase(
                readTexture,
                shaderParams,
                canvasWidth,
                canvasHeight
              )
            } catch {
              topTexture = await renderAdjustmentFromBase(
                readTexture,
                (layer as any).parameters || {},
                canvasWidth,
                canvasHeight
              )
            }
          }
          if (!topTexture) {
            // Nothing to composite for this layer
            continue
          }

          try {
            dbg("composite:over", {
              layerId: layer.id,
              layerName: (layer as any).name || null,
              renderingPath: "compositing shader (subsequent layers)",
              hasTopTexture: !!topTexture,
              hasReadTexture: !!readTexture,
              layerIndex: orderedLayers.indexOf(layer),
            })
          } catch {}
          // Composite current layer over accumulated result into the opposite target
          const output: CompTarget = writeTarget === ping ? pong : ping
          // Guard against read-write feedback: if read texture equals output target tex, copy to scratch first
          let readSource: WebGLTexture | null = readTexture
          let scratch: CompTarget | null = null
          if (readSource) {
            try {
              scratch = checkoutCompTarget(canvasWidth, canvasHeight)
              const glCtx = gl as WebGL2RenderingContext
              glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, scratch.fb)
              glCtx.viewport(0, 0, canvasWidth, canvasHeight)
              glCtx.clearColor(0, 0, 0, 0)
              glCtx.clear(glCtx.COLOR_BUFFER_BIT)

              if (!blitProgram || !blitVAO || !blitUTexLocation) {
                throw new Error("Blit resources not initialized")
              }
              glCtx.useProgram(blitProgram)
              glCtx.bindVertexArray(blitVAO)
              glCtx.activeTexture(glCtx.TEXTURE0)
              glCtx.bindTexture(glCtx.TEXTURE_2D, readSource)
              glCtx.uniform1i(blitUTexLocation as WebGLUniformLocation, 0)
              if (blitUOpacityLocation)
                glCtx.uniform1f(blitUOpacityLocation, 1.0)
              glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
              glCtx.bindVertexArray(null)
              glCtx.useProgram(null)
              readSource = scratch.tex
            } catch (e) {
              console.warn("Feedback guard copy failed:", e)
            }
          }
          {
            const glCtx = gl as WebGL2RenderingContext
            // Ensure no active textures are bound before targeting output framebuffer
            glCtx.activeTexture(glCtx.TEXTURE0)
            glCtx.bindTexture(glCtx.TEXTURE_2D, null)
            glCtx.activeTexture(glCtx.TEXTURE1)
            glCtx.bindTexture(glCtx.TEXTURE_2D, null)

            glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, output.fb)
            glCtx.viewport(0, 0, canvasWidth, canvasHeight)
            glCtx.clearColor(0, 0, 0, 0)
            glCtx.clear(glCtx.COLOR_BUFFER_BIT)

            glCtx.useProgram(compProgram)
            glCtx.bindVertexArray(compVAO)

            // Debug: Verify compositing program is active
            try {
              const activeProgram = glCtx.getParameter(glCtx.CURRENT_PROGRAM)
              dbg("compositing:program", {
                layerId: layer.id,
                activeProgram: !!activeProgram,
                expectedProgram: !!compProgram,
                match: activeProgram === compProgram,
              })
            } catch {}

            // Ensure no texture units are bound to the destination texture to avoid feedback
            try {
              unbindTextureFromAllUnits(glCtx, output.tex)
            } catch {}

            // Strong guard: ensure texture units do not point to destination texture
            glCtx.activeTexture(glCtx.TEXTURE0)
            if (readSource === output.tex) {
              try {
                const scratch2 = checkoutCompTarget(canvasWidth, canvasHeight)
                glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, scratch2.fb)
                glCtx.viewport(0, 0, canvasWidth, canvasHeight)
                glCtx.clearColor(0, 0, 0, 0)
                glCtx.clear(glCtx.COLOR_BUFFER_BIT)
                if (!blitProgram || !blitVAO || !blitUTexLocation) {
                  throw new Error("Blit resources not initialized")
                }
                glCtx.useProgram(blitProgram)
                glCtx.bindVertexArray(blitVAO)
                glCtx.activeTexture(glCtx.TEXTURE0)
                glCtx.bindTexture(glCtx.TEXTURE_2D, readSource)
                glCtx.uniform1i(blitUTexLocation as WebGLUniformLocation, 0)
                if (blitUOpacityLocation)
                  glCtx.uniform1f(blitUOpacityLocation, 1.0)
                glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
                glCtx.bindVertexArray(null)
                glCtx.useProgram(null)
                readSource = scratch2.tex
                // Restore output framebuffer
                glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, output.fb)
                returnCompTarget(scratch2)
              } catch {}
            }
            glCtx.activeTexture(glCtx.TEXTURE1)
            // Ensure unit 1 is not accidentally bound to destination before binding top
            if (topTexture === output.tex) {
              glCtx.bindTexture(glCtx.TEXTURE_2D, null)
            }

            glCtx.activeTexture(glCtx.TEXTURE0)
            glCtx.bindTexture(glCtx.TEXTURE_2D, readSource)
            try {
              dbg("draw:compose:bind-base", {
                fb: __fbIds.get(output.fb),
                baseTex: __texIds.get(readSource as WebGLTexture),
                outTex: __texIds.get(output.tex),
                hazard: readSource === output.tex,
              })
            } catch {}
            glCtx.uniform1i(compUBaseLocation as WebGLUniformLocation, 0)

            // Always copy top texture to scratch before binding to avoid any hazards
            let topSource: WebGLTexture | null = topTexture
            if (topSource) {
              try {
                const scratchTop = checkoutCompTarget(canvasWidth, canvasHeight)
                glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, scratchTop.fb)
                glCtx.viewport(0, 0, canvasWidth, canvasHeight)
                glCtx.clearColor(0, 0, 0, 0)
                glCtx.clear(glCtx.COLOR_BUFFER_BIT)
                if (!blitProgram || !blitVAO || !blitUTexLocation) {
                  throw new Error("Blit resources not initialized")
                }
                glCtx.useProgram(blitProgram)
                glCtx.bindVertexArray(blitVAO)
                glCtx.activeTexture(glCtx.TEXTURE0)
                glCtx.bindTexture(glCtx.TEXTURE_2D, topSource)
                glCtx.uniform1i(blitUTexLocation as WebGLUniformLocation, 0)
                if (blitUOpacityLocation)
                  glCtx.uniform1f(blitUOpacityLocation, 1.0)
                glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
                glCtx.bindVertexArray(null)
                glCtx.useProgram(null)
                topSource = scratchTop.tex
                // Restore output framebuffer
                glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, output.fb)
                // Return scratch to pool
                returnCompTarget(scratchTop)
              } catch (e) {
                console.warn("Top copy failed:", e)
                glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, output.fb)
              }
            }

            glCtx.activeTexture(glCtx.TEXTURE1)
            glCtx.bindTexture(glCtx.TEXTURE_2D, topSource)
            try {
              dbg("draw:compose:bind-top", {
                fb: __fbIds.get(output.fb),
                topTex: __texIds.get(topSource as WebGLTexture),
                outTex: __texIds.get(output.tex),
                hazard: topSource === output.tex,
              })
            } catch {}
            glCtx.uniform1i(compUTopLocation as WebGLUniformLocation, 1)

            if (compUOpacityLocation)
              glCtx.uniform1f(
                compUOpacityLocation,
                Math.max(0, Math.min(1, layer.opacity / 100))
              )

            // Get blend mode code with proper fallback
            const blendMode = layer.blendMode as BlendMode
            const mode = BLEND_MODE_CODE[blendMode] ?? 0

            // Debug logging for blend mode issues
            try {
              dbg("blend:mode", {
                layerId: layer.id,
                blendMode,
                mode,
                hasUniform: !!compUBlendModeLocation,
                BLEND_MODE_CODE_keys: Object.keys(BLEND_MODE_CODE),
                BLEND_MODE_CODE_values: Object.values(BLEND_MODE_CODE),
              })
            } catch {}

            if (compUBlendModeLocation) {
              // Worker compositor also expects float uniform
              glCtx.uniform1f(compUBlendModeLocation, mode)
              try {
                dbg("blend:uniform:set", {
                  layerId: layer.id,
                  mode,
                  uniformSet: true,
                })
              } catch {}
            } else {
              try {
                dbg("blend:uniform:missing", {
                  layerId: layer.id,
                  mode,
                  uniformSet: false,
                })
              } catch {}
            }

            // Debug: Log compositing draw call
            try {
              dbg("compose:draw", {
                texcoordBuffer: "compTexCoordBuffer (normal V)",
                texcoords: Array.from(RenderConfig.COMP_TEXCOORDS),
                unpackFlipY: glCtx.getParameter(glCtx.UNPACK_FLIP_Y_WEBGL),
                renderingPath: "compositing",
              })
            } catch {}

            glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
            // Unbind textures after draw to avoid any potential feedback in subsequent passes
            glCtx.activeTexture(glCtx.TEXTURE0)
            glCtx.bindTexture(glCtx.TEXTURE_2D, null)
            glCtx.activeTexture(glCtx.TEXTURE1)
            glCtx.bindTexture(glCtx.TEXTURE_2D, null)
            try {
              const err = glCtx.getError()
              if (err) dbg("gl:error", { where: "compose:after-draw", err })
            } catch {}
            glCtx.bindVertexArray(null)
            glCtx.useProgram(null)
          }

          // Swap
          writeTarget = output
          readTexture = writeTarget.tex

          // Return scratch to pool if used
          if (scratch) {
            try {
              returnCompTarget(scratch)
            } catch {}
            scratch = null
          }
        }

        finalTexture = readTexture

        // Render final to canvas
        if (drewAnyLayer && finalTexture) {
          try {
            dbg("composite:final-render", {
              hasFinalTexture: !!finalTexture,
              canvasSize: { width: canvasWidth, height: canvasHeight },
            })
          } catch {}
          await renderToCanvas(finalTexture, canvasWidth, canvasHeight)
        }
      } catch (error) {
        console.error("Failed to composite layers (blend shader):", error)
      } finally {
        // Unbind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      }
    }

    try {
      dbg("composite:end", { drewAnyLayer })
    } catch {}

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

    // Stage 5: Final output generation (skip if we already drew to default fb)
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
async function loadLayerTexture(
  layer: EditorLayer
): Promise<WebGLTexture | null> {
  if (!gl) return null

  try {
    if (layer.type !== "image" || !layer.image) return null

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
      try {
        dbg("bitmap:existing", {
          width: (imageBitmap as any).width,
          height: (imageBitmap as any).height,
        })
      } catch {}
    } else if (isBlobLike) {
      // Convert Blob/File to ImageBitmap respecting EXIF orientation
      imageBitmap = await createImageBitmap(imgAny as Blob, {
        imageOrientation: "from-image",
      })
      dbgBitmapsCreated++
      try {
        dbg("bitmap:created", {
          width: (imageBitmap as any).width,
          height: (imageBitmap as any).height,
          type: (imgAny as Blob).type,
          size: (imgAny as Blob).size,
        })
      } catch {}
    } else {
      console.warn("Unsupported image type for layer:", layer.id)
      return null
    }

    // Validate dimensions
    const dimValidation = validateImageDimensions(
      imageBitmap.width,
      imageBitmap.height
    )
    if (!dimValidation.isValid) {
      throw new Error(
        dimValidation.error ||
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
    try {
      __texIds.set(texture, __idCounter++)
    } catch {}
    try {
      dbg("texture:upload", {
        texWidth: (imageBitmap as any).width,
        texHeight: (imageBitmap as any).height,
        cacheKey,
      })
    } catch {}

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
  layer: EditorLayer,
  layerTexture: WebGLTexture,
  toolsValues: ImageEditorToolsState,
  canvasWidth: number,
  canvasHeight: number,
  layerDimensions: Array<
    [string, { width: number; height: number; x: number; y: number }]
  >
): Promise<WebGLTexture | null> {
  if (!gl || !shaderManager) return null // Legacy function - using v2 system now

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
    // Layer rendering samples uploaded bitmaps with UNPACK_FLIP_Y_WEBGL=false; use normal-V texcoords.
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, layerTexCoordBuffer as WebGLBuffer)
    glCtx.enableVertexAttribArray(aTexLoc)
    glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

    // Texture and uniforms
    glCtx.activeTexture(glCtx.TEXTURE0)
    glCtx.bindTexture(glCtx.TEXTURE_2D, layerTexture)
    const uSampler = glCtx.getUniformLocation(program, "u_image")
    if (uSampler) glCtx.uniform1i(uSampler, 0)

    const { validatedParameters } = validateFilterParameters(toolsValues)

    // Resolve per-layer bounds from state-provided dimensions
    let lx = 0
    let ly = 0
    let lw = canvasWidth
    let lh = canvasHeight
    const dim = getLayerDims(layerDimensions as any, (layer as any).id)
    if (dim && dim.width > 0 && dim.height > 0) {
      lx = dim.x
      ly = dim.y
      lw = dim.width
      lh = dim.height
    }

    // The vertex shader expects center position in pixels in UI coordinates (top-left origin)
    // The vertex shader will convert to WebGL coordinates (bottom-left origin)
    const layerCenterX = lx + lw / 2
    const layerCenterY = ly + lh / 2

    // Provide geometry uniforms so the shader can position correctly
    shaderManager.updateUniforms({
      ...validatedParameters,
      layerSize: [lw, lh],
      canvasSize: [canvasWidth, canvasHeight],
      // Vertex shader expects center position in pixels
      layerPosition: [layerCenterX, layerCenterY],
      opacity: (layer as any).opacity ?? 100,
    })

    // Debug: compute human-readable orientation for this layer pass
    try {
      const flipV = Boolean((validatedParameters as any).flipVertical)
      const flipH = Boolean((validatedParameters as any).flipHorizontal)
      const rotRaw = Number((validatedParameters as any).rotate || 0)
      const rot = ((rotRaw % 360) + 360) % 360
      const near = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol
      let baseOrient: "upright" | "upsideDown" | "rotated90" | "rotated270" =
        "upright"
      if (near(rot, 90)) baseOrient = "rotated90"
      else if (near(rot, 270)) baseOrient = "rotated270"
      else if (near(rot, 180)) baseOrient = "upsideDown"
      // Vertical flip toggles upright <-> upsideDown for non-90/270 cases
      let finalOrient = baseOrient
      if (baseOrient === "upright" || baseOrient === "upsideDown") {
        if (flipV) {
          finalOrient = baseOrient === "upright" ? "upsideDown" : "upright"
        }
      }
      dbg("layer:orientation", {
        layerId: (layer as any).id,
        layerName: (layer as any).name || null,
        flipVertical: flipV,
        flipHorizontal: flipH,
        rotate: rot,
        texcoordV: "flipped", // layer pass uses flipped V texcoords
        orientation: finalOrient,
      })
    } catch {}

    // Debug: Log layer uniforms and transformations
    try {
      dbg("layer:uniforms", {
        layerId: (layer as any).id,
        layerX: lx,
        layerY: ly,
        layerW: lw,
        layerH: lh,
        canvasW: canvasWidth,
        canvasH: canvasHeight,
        layerCenterX,
        layerCenterY,
        opacity: (layer as any).opacity ?? 100,
        flipHorizontal: validatedParameters.flipHorizontal,
        flipVertical: validatedParameters.flipVertical,
        rotate: validatedParameters.rotate,
        scale: validatedParameters.scale,
        renderingPath: "shaderManager (with Y-flip transformation)",
        vertexShader: "VertexShaderPlugin with coordinate system conversion",
        texcoordBuffer: "layerTexCoordBuffer (normal V)",
        texcoords: Array.from(RenderConfig.LAYER_TEXCOORDS),
        unpackFlipY: glCtx.getParameter(glCtx.UNPACK_FLIP_Y_WEBGL),
      })
    } catch {}
    shaderManager.setUniforms(glCtx, program)

    // Draw to a temporary target to avoid feedback with compositing ping/pong
    const tempTarget = checkoutCompTarget(canvasWidth, canvasHeight)
    glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, tempTarget.fb)
    glCtx.viewport(0, 0, canvasWidth, canvasHeight)
    glCtx.clearColor(0, 0, 0, 0)
    glCtx.clear(glCtx.COLOR_BUFFER_BIT)
    glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)

    // Cleanup binds
    glCtx.bindVertexArray(null)
    glCtx.useProgram(null)
    glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, null)

    return tempTarget.tex
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
  if (!gl || !shaderManager) return null // Legacy function - using v2 system now

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
    // Adjustment-from-base samples the full-canvas base FBO (upright); use normal texcoords.
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, blitTexCoordBuffer as WebGLBuffer)
    glCtx.enableVertexAttribArray(aTexLoc)
    glCtx.vertexAttribPointer(aTexLoc, 2, glCtx.FLOAT, false, 0, 0)

    // Guard: do not sample from a texture attached to the active draw framebuffer
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

    // Debug: Log adjustment rendering
    try {
      dbg("adjustment:uniforms", {
        texcoordBuffer: "blitTexCoordBuffer (normal V)",
        texcoords: Array.from(RenderConfig.COMP_TEXCOORDS),
        unpackFlipY: glCtx.getParameter(glCtx.UNPACK_FLIP_Y_WEBGL),
        renderingPath: "renderAdjustmentFromBase",
      })
    } catch {}

    // Draw into a pooled comp target (distinct from the texture being sampled)
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
  if (!gl || !passGraphPipeline || !pgPositionBuffer || !pgCompTexcoordBuffer)
    return null

  try {
    if (layerTextures.length === 0) return null
    let acc: WebGLTexture | null = null
    for (let i = 0; i < layerTextures.length; i++) {
      const [layerId, tex] = layerTextures[i]
      if (!acc) {
        acc = tex
        continue
      }
      // Mask plumbing: lookup mask on the current layer if provided and bind
      const maskTex: WebGLTexture | null =
        maskTextures.get(`${layerId}:mask`) || null
      const out = passGraphPipeline.runSingle(
        {
          shaderName: "compositor",
          uniforms: {
            u_blendMode: 0,
            u_opacity: 100,
            u_hasMask: maskTex ? 1 : 0,
            // Default mask params when layer metadata not available here
            u_maskParams: [0, 0, 1, 0],
          },
          channels: maskTex
            ? { u_baseTexture: acc, u_topTexture: tex, u_maskTexture: maskTex }
            : { u_baseTexture: acc, u_topTexture: tex },
          targetFboName: "result",
        },
        canvasWidth,
        canvasHeight,
        { position: pgPositionBuffer, texcoord: pgCompTexcoordBuffer }
      )
      if (out) acc = out
    }
    return acc
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
    // Debug: Log final canvas rendering
    try {
      dbg("renderToCanvas:start", {
        canvasSize: { width: canvasWidth, height: canvasHeight },
        hasTexture: !!finalTexture,
      })
    } catch {}
    // Prefer WebGL2 framebuffer blit to avoid any sampling feedback/invalid op
    const gl2 = gl as WebGL2RenderingContext
    // Ensure final texture is not bound to any texture unit prior to blit
    try {
      unbindTextureFromAllUnits(gl2, finalTexture)
    } catch {}
    // Create temp FBO to attach the final texture as READ_FRAMEBUFFER
    const srcFbo = gl2.createFramebuffer()
    if (!srcFbo)
      throw new Error("Failed to create temp framebuffer for final blit")
    gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, srcFbo)
    gl2.framebufferTexture2D(
      gl2.READ_FRAMEBUFFER,
      gl2.COLOR_ATTACHMENT0,
      gl2.TEXTURE_2D,
      finalTexture,
      0
    )
    // Default framebuffer as draw target
    gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, null)
    gl2.viewport(0, 0, canvasWidth, canvasHeight)
    gl2.clearColor(0, 0, 0, 0)
    gl2.clear(gl2.COLOR_BUFFER_BIT)
    // Blit copy
    gl2.blitFramebuffer(
      0,
      0,
      canvasWidth,
      canvasHeight,
      0,
      0,
      canvasWidth,
      canvasHeight,
      gl2.COLOR_BUFFER_BIT,
      gl2.NEAREST
    )
    // Check for GL errors that indicate blit failed (e.g., multisampled default framebuffer)
    const blitError = gl2.getError()
    // Cleanup FBO bindings before potential fallback
    gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, null)
    gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, null)
    gl2.deleteFramebuffer(srcFbo)

    if (blitError !== gl2.NO_ERROR) {
      // Fallback: draw a fullscreen quad using the blit shader
      try {
        // Debug: Log fallback to blit shader
        try {
          dbg("renderToCanvas:blit-fallback", {
            blitError,
            reason: "framebuffer blit failed",
          })
        } catch {}
        // Bind default framebuffer explicitly
        gl2.bindFramebuffer(gl2.FRAMEBUFFER, null)
        gl2.viewport(0, 0, canvasWidth, canvasHeight)
        gl2.clearColor(0, 0, 0, 0)
        gl2.clear(gl2.COLOR_BUFFER_BIT)

        if (!blitProgram || !blitVAO || !blitUTexLocation) {
          throw new Error("Blit resources not initialized for final draw")
        }

        gl2.useProgram(blitProgram)
        gl2.bindVertexArray(blitVAO)
        gl2.activeTexture(gl2.TEXTURE0)
        gl2.bindTexture(gl2.TEXTURE_2D, finalTexture)
        gl2.uniform1i(blitUTexLocation as WebGLUniformLocation, 0)
        if (blitUOpacityLocation) gl2.uniform1f(blitUOpacityLocation, 1.0)
        gl2.drawArrays(gl2.TRIANGLE_STRIP, 0, 4)
        gl2.bindVertexArray(null)
        gl2.useProgram(null)
      } catch (fallbackError) {
        console.error("Final draw fallback failed:", fallbackError)
      }
    }
  } catch (error) {
    console.error("Failed to render to canvas:", error)
  }
}

// Message handler
self.onmessage = async (event: MessageEvent) => {
  const message: WorkerMessage = event.data
  try {
    ;(self as any).__lastMessageData = (message as any).data
  } catch {}

  try {
    switch (message.type) {
      case "shader:sync-registry": {
        // Receive v2 shader registry payload (full descriptors) and replace registry
        try {
          const data = (message as any).data || {}
          const descriptors = Array.isArray(data.descriptors)
            ? (data.descriptors as any[])
            : []
          if (descriptors.length) {
            try {
              ;(GlobalShaderRegistryV2 as any).replaceAll(descriptors)
            } catch {}
          }
          if (typeof data.version === "number")
            shaderRegistryVersion = data.version
          postMessage({ type: "success", id: message.id } as SuccessMessage)
        } catch {}
        break
      }
      case "shader:prepare": {
        // Pre-warm requested shaders/passes (with optional variant keys)
        try {
          const payload = (message as any).data || { shaderNames: [] }
          if (shaderManagerV2 && gl) {
            try {
              registerBuiltinShaders(GlobalShaderRegistryV2)
            } catch {}
            shaderManagerV2.prepareForMode("worker", null)
            const names: string[] = Array.isArray(payload.shaderNames)
              ? payload.shaderNames
              : []
            const variantsMap: Record<string, string[]> =
              (payload.variants as Record<string, string[]>) || {}
            const flatVariantKeys: string[] = Array.isArray(payload.variantKeys)
              ? (payload.variantKeys as string[])
              : []
            const rt = shaderManagerV2.getActiveRuntime()
            for (const n of names) {
              const s = shaderManagerV2.getRegistry().get(n)
              if (!s) continue
              const variantList = variantsMap[n] ||
                flatVariantKeys || [undefined as any]
              const uniqueVariants = Array.from(new Set(variantList))
              for (const v of uniqueVariants) {
                if (s.passes && s.passes.length > 0) {
                  for (const p of s.passes) {
                    rt.getOrCompileProgram({
                      shader: s,
                      variantKey: v,
                      passId: p.id,
                    })
                  }
                } else {
                  rt.getOrCompileProgram({ shader: s, variantKey: v })
                }
              }
            }
          }
          postMessage({ type: "success", id: message.id } as SuccessMessage)
        } catch {}
        break
      }
      case "shader:context-loss": {
        try {
          if (shaderManagerV2 && gl) {
            shaderManagerV2.cleanup("worker")
            shaderManagerV2.initialize(gl as WebGL2RenderingContext, "worker")
            registerBuiltinShaders(GlobalShaderRegistryV2)
            shaderManagerV2.prepareForMode("worker", null)
          }
          postMessage({ type: "success", id: message.id } as SuccessMessage)
        } catch {
          postMessage({
            type: "error",
            id: message.id,
            error: "context-loss-rebuild-failed",
          } as ErrorMessage)
        }
        break
      }
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

      case "resize": {
        const { width, height } = (message as ResizeMessage).data
        if (!gl || !canvas) {
          postMessage({
            type: "error",
            id: message.id,
            error: "WebGL context not initialized",
          } as ErrorMessage)
          break
        }
        try {
          // Resize canvas and viewport
          canvas.width = width
          canvas.height = height
          gl.viewport(0, 0, width, height)

          // Reset persistent targets so they'll be recreated at the new size
          compPingTarget = null
          compPongTarget = null

          // Reinitialize heavy helpers that depend on dimensions
          if (hybridRendererInstance) {
            try {
              hybridRendererInstance.initialize({
                gl: gl as WebGL2RenderingContext,
                width,
                height,
              })
            } catch {}
          }
          if (asynchronousPipeline) {
            try {
              asynchronousPipeline.initialize({
                gl: gl as WebGL2RenderingContext,
                width,
                height,
              })
            } catch {}
          }

          // Debug: confirm new size
          try {
            dbg("resize:size", {
              requestedWidth: width,
              requestedHeight: height,
              canvasWidth: (canvas as OffscreenCanvas).width,
              canvasHeight: (canvas as OffscreenCanvas).height,
            })
          } catch {}

          postMessage({ type: "success", id: message.id } as SuccessMessage)
        } catch (e) {
          postMessage({
            type: "error",
            id: message.id,
            error: e instanceof Error ? e.message : "Resize failed",
          } as ErrorMessage)
        }
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
