// Render Worker for WebGL operations using OffscreenCanvas
// This worker handles all GPU-intensive operations to prevent main thread blocking

import type { Layer } from "@/components/image-editor/layer-system"
import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"
import type { PipelineStage } from "@/lib/shaders/asynchronous-pipeline"
import { AsynchronousPipeline } from "@/lib/shaders/asynchronous-pipeline"
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
// Temporary flag: disable pipeline path until pipeline produces final textures
const USE_PIPELINE = false
let currentRenderMessageId: string | null = null
const pipelineTaskToWorkerId = new Map<string, string>()

// Simple blit program resources (fullscreen textured quad)
let blitProgram: WebGLProgram | null = null
let blitVAO: WebGLVertexArrayObject | null = null
let blitPositionBuffer: WebGLBuffer | null = null
let blitTexCoordBuffer: WebGLBuffer | null = null
let blitUTexLocation: WebGLUniformLocation | null = null
let blitUOpacityLocation: WebGLUniformLocation | null = null

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
  // Flip Y in shader so we don't depend on UNPACK_FLIP_Y_WEBGL
  vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);\n
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
  // Use texcoords that map the image 1:1; flipping handled in shader
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

    // Initialize blit resources
    initBlitResources(gl)

    // Initialize asynchronous pipeline
    asynchronousPipeline = new AsynchronousPipeline({
      enableProgressiveRendering: true,
      maxConcurrentStages: 2,
      enableMemoryMonitoring: true,
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
        }
      },
      onError: (taskId: string, error: string) => {
        const workerId =
          pipelineTaskToWorkerId.get(taskId) || currentRenderMessageId
        if (workerId) {
          postMessage({ type: "error", id: workerId, error } as ErrorMessage)
        }
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

    // Stage 1: Layer preprocessing and texture preparation
    const layerTextures = new Map<string, WebGLTexture>()

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

    // Stage 3: Layer compositing and blending (immediate draw to canvas)
    let finalTexture: WebGLTexture | null = null
    let drewAnyLayer = false

    if (renderedLayers.size > 0) {
      try {
        // Bind default framebuffer and clear
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvasWidth, canvasHeight)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        if (!blitProgram || !blitVAO || !blitUTexLocation) {
          throw new Error("Blit resources not initialized")
        }

        // Enable alpha blending for layer compositing
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA
        )

        gl.useProgram(blitProgram)
        gl.bindVertexArray(blitVAO)

        // Draw layers bottom -> top
        const orderedLayers = layers.slice().reverse()
        for (const layer of orderedLayers) {
          const tex = renderedLayers.get(layer.id)
          if (!tex || layer.visible === false || layer.opacity <= 0) continue

          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, tex)
          gl.uniform1i(blitUTexLocation, 0)

          // Apply layer opacity (0-100 → 0.0-1.0)
          if (blitUOpacityLocation) {
            gl.uniform1f(
              blitUOpacityLocation,
              Math.max(0, Math.min(1, layer.opacity / 100))
            )
          }

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

          // Keep reference to last texture for post-processing if needed
          finalTexture = tex
          drewAnyLayer = true
        }

        // Cleanup binds
        gl.bindVertexArray(null)
        gl.useProgram(null)
        gl.disable(gl.BLEND)
      } catch (error) {
        console.error("Failed to composite layers (immediate):", error)
      }
    }

    postMessage({
      type: "progress",
      id: messageId,
      progress: 90,
    } as ProgressMessage)

    // Try pipeline path for progressive rendering
    if (USE_PIPELINE && asynchronousPipeline) {
      try {
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
}

// Load layer texture with validation
async function loadLayerTexture(layer: Layer): Promise<WebGLTexture | null> {
  if (!gl) return null

  try {
    if (!layer.image) return null

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

    // Handle both File and ImageBitmap objects
    if (layer.image instanceof ImageBitmap) {
      imageBitmap = layer.image
    } else if (layer.image instanceof File) {
      // Convert File to ImageBitmap for efficient transfer
      imageBitmap = await createImageBitmap(layer.image)
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
  if (!gl) return null

  try {
    // For now, just return the original texture
    // TODO: Implement actual filter rendering using shaders
    return layerTexture
  } catch (error) {
    console.error("Failed to render layer with filters:", error)
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
    // Clean up WebGL resources
    gl.deleteTexture(gl.createTexture()) // Placeholder cleanup
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
