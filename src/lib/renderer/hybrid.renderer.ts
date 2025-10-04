import { FBOManager, type FBO } from "@/lib/renderer/fbo-manager.renderer"
import { BLEND_MODE_MAP } from "@/lib/shaders/blend-modes/blend-modes"
import type { BlendMode } from "@/lib/shaders/blend-modes/types.blend"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import type { EditorLayer as Layer } from "@/lib/editor/state"
import { RenderConfig } from "@/lib/renderer/render-config.renderer"
// Removed: sampleToolsAtTime (we use memoized sampler)
import { ShaderManager } from "@/lib/shaders/manager.shader"
import { GlobalShaderRegistryV2 } from "@/lib/shaders/registry.shader"
import { registerBuiltinShaders } from "@/lib/shaders/register-builtin.shader"
import { HybridPassGraphPipeline } from "@/lib/renderer/hybrid-pipeline.renderer"
import { config } from "@/config"

export interface HybridRendererOptions {
  width: number
  height: number
  gl: WebGL2RenderingContext
}

const { isDebug } = config()

export class HybridRenderer {
  private gl: WebGL2RenderingContext | null = null
  private width = 0
  private height = 0
  private fboManager: FBOManager
  private compositingProgram: WebGLProgram | null = null
  // NDC position buffer for compositing/fullscreen passes
  private positionBuffer: WebGLBuffer | null = null
  // Separate texcoord buffers: layer sampling vs FBO compositing/adjustments
  private layerTexCoordBuffer: WebGLBuffer | null = null
  private compTexCoordBuffer: WebGLBuffer | null = null
  private layerTexture: WebGLTexture | null = null
  private compositingTexture: WebGLTexture | null = null
  private maskTextures: Map<string, WebGLTexture> = new Map()
  private pendingMaskDecodes: Set<string> = new Set()

  // Position buffer for plugin vertex shader (expects [0..1] quad)
  private pluginPositionBuffer: WebGLBuffer | null = null

  constructor() {
    this.fboManager = new FBOManager()
  }

  private shaderManagerV2: ShaderManager | null = null
  private passGraph: HybridPassGraphPipeline | null = null
  private colorSpaceFlag = 0 // 0=srgb,1=linear,2=display-p3

  private computeTransformMat3(
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

  private getOrCreateMaskTexture(layer: any): WebGLTexture | null {
    const id = layer?.id
    if (!id || !this.gl) return null
    const key = `${id}:mask`
    const existing = this.maskTextures.get(key)
    if (existing) return existing
    const mask = layer?.mask
    if (!mask || !mask.image) return null
    // If we have an ImageBitmap, we can upload synchronously
    if (
      typeof ImageBitmap !== "undefined" &&
      mask.image instanceof ImageBitmap
    ) {
      const tex = this.gl.createTexture()
      if (!tex) return null
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex)
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE
      )
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_T,
        this.gl.CLAMP_TO_EDGE
      )
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR
      )
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      )
      try {
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGBA,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          mask.image as ImageBitmap
        )
      } catch {}
      this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      this.maskTextures.set(key, tex)
      return tex
    }
    // Otherwise, request async decode/upload for Blob/File/ArrayBuffer
    this.requestMaskDecode(layer)
    return null
  }

  private async requestMaskDecode(layer: any): Promise<void> {
    const id = layer?.id
    if (!id || !this.gl) return
    const key = `${id}:mask`
    if (this.pendingMaskDecodes.has(key)) return
    this.pendingMaskDecodes.add(key)
    try {
      const mask = layer?.mask
      const src: any = mask?.image
      if (!src) return
      let bitmap: ImageBitmap | null = null
      try {
        const isBlobLike =
          src && typeof src.size === "number" && typeof src.type === "string"
        const isArrayBuffer =
          src && (src as ArrayBuffer).byteLength !== undefined
        if (isBlobLike) {
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
      if (!bitmap) return
      const tex = this.gl.createTexture()
      if (!tex) return
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex)
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE
      )
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_T,
        this.gl.CLAMP_TO_EDGE
      )
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR
      )
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      )
      try {
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGBA,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          bitmap
        )
      } catch {}
      this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      try {
        if (typeof (bitmap as any).close === "function") (bitmap as any).close()
      } catch {}
      this.maskTextures.set(key, tex)
    } finally {
      this.pendingMaskDecodes.delete(`${layer?.id}:mask`)
    }
  }

  initialize(options: HybridRendererOptions): boolean {
    const { gl, width, height } = options
    this.gl = gl
    this.width = width
    this.height = height

    // Configure WebGL with centralized settings
    RenderConfig.configureWebGL(gl)

    // Debug: Log HybridRenderer initialization
    isDebug &&
      console.debug("HybridRenderer initialized:", {
        width,
        height,
        ...RenderConfig.getDebugInfo(gl),
      })

    // Initialize FBO manager
    this.fboManager.initialize(gl)

    // Create FBOs for compositing - use ping-pong system to avoid feedback loops
    const tempFBO = this.fboManager.createFBO(width, height, "temp")
    const pingFBO = this.fboManager.createFBO(width, height, "ping")
    const pongFBO = this.fboManager.createFBO(width, height, "pong")
    const resultFBO = this.fboManager.createFBO(width, height, "result")

    if (!tempFBO || !pingFBO || !pongFBO || !resultFBO) {
      console.error("Failed to create FBOs:", {
        tempFBO: !!tempFBO,
        pingFBO: !!pingFBO,
        pongFBO: !!pongFBO,
        resultFBO: !!resultFBO,
      })
      return false
    }

    // Initialize v2 shader manager and register builtins
    this.shaderManagerV2 = new ShaderManager(GlobalShaderRegistryV2)
    this.shaderManagerV2.initialize(this.gl as WebGL2RenderingContext, "hybrid")
    registerBuiltinShaders()

    // Compile compositing program using v2 compositor shader
    const compositorShader = this.shaderManagerV2.getShader("compositor")
    if (!compositorShader) {
      console.error("Failed to get compositor shader from v2 system")
      return false
    }

    const rt = this.shaderManagerV2.getActiveRuntime()
    const handle = rt.getOrCompileProgram({ shader: compositorShader })
    if (!handle) {
      console.error("Failed to compile compositor shader")
      return false
    }

    this.compositingProgram = handle.program

    this.passGraph = new HybridPassGraphPipeline(
      gl,
      this.fboManager,
      this.shaderManagerV2
    )

    // Create buffers
    this.positionBuffer = gl.createBuffer()
    this.layerTexCoordBuffer = RenderConfig.createLayerTexCoordBuffer(gl)
    this.compTexCoordBuffer = RenderConfig.createCompTexCoordBuffer(gl)

    if (
      !this.positionBuffer ||
      !this.layerTexCoordBuffer ||
      !this.compTexCoordBuffer
    ) {
      console.error("Failed to create buffers:", {
        positionBuffer: !!this.positionBuffer,
        layerTexCoordBuffer: !!this.layerTexCoordBuffer,
        compTexCoordBuffer: !!this.compTexCoordBuffer,
      })
      return false
    }

    // Set up position buffer (NDC) for compositing/fullscreen passes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )

    // Set up plugin position buffer ([0..1] quad) for layer rendering via ShaderManager
    this.pluginPositionBuffer = gl.createBuffer()
    if (!this.pluginPositionBuffer) {
      console.error("Failed to create plugin position buffer")
      return false
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pluginPositionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    )

    // Texcoord buffers are now configured by RenderConfig.create*TexCoordBuffer()

    // Create textures
    this.layerTexture = gl.createTexture()
    this.compositingTexture = gl.createTexture()

    if (!this.layerTexture || !this.compositingTexture) {
      console.error("Failed to create textures:", {
        layerTexture: !!this.layerTexture,
        compositingTexture: !!this.compositingTexture,
      })
      return false
    }

    // Set up layer texture
    gl.bindTexture(gl.TEXTURE_2D, this.layerTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // Set up compositing texture
    gl.bindTexture(gl.TEXTURE_2D, this.compositingTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    return true
  }

  setColorSpace(flag: number): void {
    this.colorSpaceFlag = flag
  }

  renderLayer(
    layer: Layer,
    layerTexture: WebGLTexture,
    toolsValues: ImageEditorToolsState,
    canvasWidth: number,
    canvasHeight: number,
    layerDimensions?: Map<
      string,
      { width: number; height: number; x: number; y: number }
    >
  ): WebGLTexture | null {
    if (!this.gl || !this.shaderManagerV2) return null

    // Use the temp FBO for layer rendering
    const tempFBO = this.fboManager.getFBO("temp")
    if (!tempFBO) {
      console.error("Temp FBO not found")
      return null
    }

    // Bind temp FBO for rendering
    this.fboManager.bindFBO("temp")
    this.fboManager.clearFBO("temp", 0, 0, 0, 0)

    // Ensure we're not reading from the same texture we're writing to
    if (tempFBO.texture === layerTexture) {
      console.warn(
        "Attempting to read from and write to the same texture, skipping layer"
      )
      return null
    }

    // Additional check for any FBO texture that might cause feedback
    if (this.fboManager.isTextureBoundToFBO(layerTexture)) {
      console.warn(
        "Layer texture is bound to an FBO texture, potential feedback loop detected"
      )
      return null
    }

    // Get layer dimensions and position
    const layerDim = layerDimensions?.get(layer.id)
    const layerWidth = layerDim?.width || canvasWidth
    const layerHeight = layerDim?.height || canvasHeight
    const layerX = layerDim?.x || 0
    const layerY = layerDim?.y || 0

    // Use v2 pipeline instead of legacy program (render layer content via copy shader)
    if (!this.shaderManagerV2 || !this.passGraph) return null
    const u_transform = this.computeTransformMat3(
      Number((toolsValues as any).scale || 1),
      Number((toolsValues as any).rotate || 0),
      Boolean((toolsValues as any).flipHorizontal),
      Boolean((toolsValues as any).flipVertical)
    )
    const placedOut = this.passGraph.runSingle(
      {
        shaderName: "layer.render",
        uniforms: {
          u_transform,
          u_colorSpace: this.colorSpaceFlag,
          u_layerSize: [layerWidth, layerHeight],
          u_canvasSize: [canvasWidth, canvasHeight],
          // Center position in canvas pixels (top-left origin)
          u_layerPosition: [layerX + layerWidth / 2, layerY + layerHeight / 2],
        },
        channels: { u_texture: layerTexture },
        targetFboName: "temp",
      },
      canvasWidth,
      canvasHeight,
      {
        // Vertex expects [0..1] quad in a_position -> use pluginPositionBuffer
        position: this.pluginPositionBuffer as WebGLBuffer,
        // Sampling uploaded bitmap -> use layer texcoords (flipped V policy)
        texcoord: this.layerTexCoordBuffer as WebGLBuffer,
      }
    )
    if (!placedOut) return null

    // Attributes bound within pass-graph execution

    // Debug: Log layer orientation and texcoords
    try {
      const rotRaw = Number((toolsValues as any).rotate || 0)
      const rot = ((rotRaw % 360) + 360) % 360
      const flipV = Boolean((toolsValues as any).flipVertical)
      const flipH = Boolean((toolsValues as any).flipHorizontal)
      const near = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol
      let baseOrient: "upright" | "upsideDown" | "rotated90" | "rotated270" =
        "upright"
      if (near(rot, 90)) baseOrient = "rotated90"
      else if (near(rot, 270)) baseOrient = "rotated270"
      else if (near(rot, 180)) baseOrient = "upsideDown"
      let finalOrient = baseOrient
      if (baseOrient === "upright" || baseOrient === "upsideDown") {
        if (flipV) {
          finalOrient = baseOrient === "upright" ? "upsideDown" : "upright"
        }
      }
      isDebug &&
        console.debug("HybridRenderer layer:orientation", {
          layerId: (layer as any).id,
          flipVertical: flipV,
          flipHorizontal: flipH,
          rotate: rot,
          texcoordV: "normal",
          orientation: finalOrient,
          unpackFlipY: this.gl.getParameter(this.gl.UNPACK_FLIP_Y_WEBGL),
        })
    } catch {}

    // No direct GL bind; sampling chained via pass graph

    // Build uniforms for plugin-based program
    const layerCenterX = layerX + layerWidth / 2
    const layerCenterY = layerY + layerHeight / 2
    // Normalize colorize: accept number or { value, color }
    let colorizeAmount = 0
    let recolorColor: [number, number, number] | null = null
    const recolorAny: any = (toolsValues as any).colorize
    if (typeof recolorAny === "number") {
      colorizeAmount = recolorAny
      recolorColor = [1, 0, 0]
    } else if (
      recolorAny &&
      typeof recolorAny === "object" &&
      typeof recolorAny.value === "number"
    ) {
      colorizeAmount = recolorAny.value
      const hex =
        typeof recolorAny.color === "string" ? recolorAny.color : "#000000"
      const rgba = this.hexToRgba01(hex) || [0, 0, 0, 1]
      recolorColor = [rgba[0], rgba[1], rgba[2]]
    }

    // Only pass numeric/boolean (as 0/1) uniforms derived from sampled values
    const scalarUniforms: Record<string, number> = {}
    for (const [k, v] of Object.entries(toolsValues as any)) {
      if (typeof v === "number") scalarUniforms[k] = v
      else if (typeof v === "boolean") scalarUniforms[k] = v ? 1 : 0
      // ignore objects/strings; handled explicitly below if needed
    }
    const uniformsUpdate: Record<string, any> = {
      ...scalarUniforms,
      // enforce numeric colorize amount for plugin uniform
      colorize: colorizeAmount,
      u_opacity: 100,
      layerSize: [layerWidth, layerHeight],
      canvasSize: [canvasWidth, canvasHeight],
      layerPosition: [layerCenterX, layerCenterY],
      u_resolution: [canvasWidth, canvasHeight],
    }
    if (recolorColor) uniformsUpdate.u_recolorColor = recolorColor

    // Uniforms pushed through pass graph when needed

    // Draw
    return placedOut
  }

  // Render an adjustment layer by applying its parameters to the current accumulated texture
  // This produces a full-canvas texture that represents the adjusted result of the base
  private renderAdjustmentToTexture(
    baseTexture: WebGLTexture,
    adjustmentTools: ImageEditorToolsState,
    canvasWidth: number,
    canvasHeight: number
  ): WebGLTexture | null {
    if (!this.gl || !this.shaderManagerV2 || !this.passGraph) return null

    const sx = Number((adjustmentTools as any).scale || 1)
    const rot = Number((adjustmentTools as any).rotate || 0)
    const flipH = Boolean((adjustmentTools as any).flipHorizontal)
    const flipV = Boolean((adjustmentTools as any).flipVertical)
    const u_transform = this.computeTransformMat3(sx, rot, flipH, flipV)

    // Start from base texture and sequentially apply enabled adjustments
    let lastTexture: WebGLTexture | null = baseTexture
    const baseUniforms = {
      u_opacity: 100,
      u_colorSpace: this.colorSpaceFlag,
      u_transform,
      u_resolution: [canvasWidth, canvasHeight] as [number, number],
    }

    const p: any = adjustmentTools as any

    const runSinglePass = (
      shaderName: string,
      uniforms: Record<string, unknown>
    ): void => {
      if (!lastTexture) return
      const out = this.passGraph?.runSingle(
        {
          shaderName,
          uniforms: { ...baseUniforms, ...uniforms },
          channels: { u_texture: lastTexture },
          targetFboName: "temp",
        },
        canvasWidth,
        canvasHeight,
        {
          position: this.positionBuffer as WebGLBuffer,
          texcoord: this.compTexCoordBuffer as WebGLBuffer,
        }
      )
      if (out) lastTexture = out
    }

    // Order matters: tonal first, then color, then special effects
    if (typeof p.brightness === "number" && p.brightness !== 100) {
      runSinglePass("adjustments.brightness", {
        u_brightness: Number(p.brightness),
      })
    }
    if (typeof p.contrast === "number" && p.contrast !== 100) {
      runSinglePass("adjustments.contrast", { u_contrast: Number(p.contrast) })
    }
    if (typeof p.exposure === "number" && p.exposure !== 0) {
      runSinglePass("adjustments.exposure", { u_exposure: Number(p.exposure) })
    }
    if (typeof p.gamma === "number" && p.gamma !== 1) {
      runSinglePass("adjustments.gamma", { u_gamma: Number(p.gamma) })
    }

    if (typeof p.hue === "number" && p.hue !== 0) {
      runSinglePass("adjustments.hue", { u_hue: Number(p.hue) })
    }
    if (typeof p.saturation === "number" && p.saturation !== 100) {
      runSinglePass("adjustments.saturation", {
        u_saturation: Number(p.saturation),
      })
    }

    if (typeof p.temperature === "number" && p.temperature !== 0) {
      runSinglePass("adjustments.temperature", {
        u_temperature: Number(p.temperature),
      })
    }
    if (typeof p.tint === "number" && p.tint !== 0) {
      runSinglePass("adjustments.tint", { u_tint: Number(p.tint) })
    }

    if (typeof p.grayscale === "number" && p.grayscale > 0) {
      runSinglePass("adjustments.grayscale", {
        u_grayscale: Number(p.grayscale),
      })
    }
    if (typeof p.invert === "number" && p.invert > 0) {
      runSinglePass("adjustments.invert", { u_invert: Number(p.invert) })
    }
    if (typeof p.sepia === "number" && p.sepia > 0) {
      runSinglePass("adjustments.sepia", { u_sepia: Number(p.sepia) })
    }

    if (typeof p.vibrance === "number" && p.vibrance !== 0) {
      runSinglePass("adjustments.vibrance", { u_vibrance: Number(p.vibrance) })
    }

    if (typeof p.colorizeAmount === "number" && p.colorizeAmount > 0) {
      runSinglePass("adjustments.colorize", {
        u_colorizeHue: Number(p.colorizeHue || 0),
        u_colorizeSaturation: Number(p.colorizeSaturation || 0),
        u_colorizeLightness: Number(p.colorizeLightness || 0),
        u_colorizePreserveLum: Number(p.colorizePreserveLum ? 1 : 0),
        u_colorizeAmount: Number(p.colorizeAmount || 0),
      })
    }

    {
      const sharpenAmt = Number(p.sharpenAmount || 0)
      if (!Number.isNaN(sharpenAmt) && sharpenAmt > 0) {
        runSinglePass("adjustments.sharpen", {
          u_sharpenAmount: sharpenAmt,
          u_sharpenRadius: Number(p.sharpenRadius || 1),
          u_sharpenThreshold: Number(p.sharpenThreshold || 0),
        })
      }
    }

    if (typeof p.noiseAmount === "number" && p.noiseAmount > 0) {
      runSinglePass("adjustments.noise", {
        u_noiseAmount: Number(p.noiseAmount || 0),
        u_noiseSize: Number(p.noiseSize || 1),
      })
    }

    {
      const gAmt = Number(p.gaussianAmount || 0)
      if (!Number.isNaN(gAmt) && gAmt > 0) {
        // Two-pass separable Gaussian blur, mixed by amount in the second pass
        const radius = Math.max(0.1, Number(p.gaussianRadius || 1))
        // First pass (horizontal)
        if (lastTexture) {
          const outH = this.passGraph.runSingle(
            {
              shaderName: "adjustments.gaussian_blur",
              passId: "horizontal_blur",
              uniforms: { ...baseUniforms, u_radius: radius },
              channels: { u_texture: lastTexture },
              targetFboName: "temp",
            },
            canvasWidth,
            canvasHeight,
            {
              position: this.positionBuffer as WebGLBuffer,
              texcoord: this.compTexCoordBuffer as WebGLBuffer,
            }
          )
          if (outH) {
            // Second pass (vertical + mix with original). Bind original and previous pass.
            const outV = this.passGraph.runSingle(
              {
                shaderName: "adjustments.gaussian_blur",
                passId: "vertical_blur",
                uniforms: { ...baseUniforms, u_radius: radius, u_amount: gAmt },
                channels: { u_texture: lastTexture, u_previousPass: outH },
                targetFboName: "temp",
              },
              canvasWidth,
              canvasHeight,
              {
                position: this.positionBuffer as WebGLBuffer,
                texcoord: this.compTexCoordBuffer as WebGLBuffer,
              }
            )
            if (outV) lastTexture = outV
            else lastTexture = outH
          }
        }
      }
    }

    // Solid overlay (if present in tools)
    if (Number(p.solidEnabled ? 1 : 0) === 1) {
      runSinglePass("adjustments.solid", {
        u_solidEnabled: 1,
        u_solidColor: Array.isArray(p.solidColor) ? p.solidColor : [0, 0, 0],
        u_solidAlpha: Number(p.solidAlpha || 1),
      })
    }

    return lastTexture
  }

  private renderAdjustmentLayerToTexture(
    baseTexture: WebGLTexture,
    adjustmentType: string,
    mappedParams: Record<string, any>,
    canvasWidth: number,
    canvasHeight: number
  ): WebGLTexture | null {
    if (!this.gl || !this.shaderManagerV2 || !this.passGraph) return null

    let lastTexture: WebGLTexture | null = baseTexture
    const u_transform = this.computeTransformMat3(1, 0, false, false)
    const baseUniforms = {
      u_opacity: 100,
      u_colorSpace: this.colorSpaceFlag,
      u_transform,
      u_resolution: [canvasWidth, canvasHeight] as [number, number],
    }

    const p: any = mappedParams || {}

    // Dynamic plugin-driven execution
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { buildAdjustmentPasses } =
        require("@/lib/adjustments/runtime") as any
      const steps = buildAdjustmentPasses(String(adjustmentType), p) as Array<{
        shaderName: string
        passId?: string
        uniforms: Record<string, unknown>
        withPreviousPass?: boolean
      }>
      if (steps && steps.length > 0) {
        let prev: WebGLTexture | null = null
        for (const step of steps) {
          if (!lastTexture) break
          const out = this.passGraph?.runSingle(
            {
              shaderName: step.shaderName,
              passId: step.passId,
              uniforms: { ...baseUniforms, ...step.uniforms },
              channels: step.withPreviousPass
                ? { u_texture: lastTexture, u_previousPass: prev as any }
                : { u_texture: lastTexture },
              targetFboName: "temp",
            },
            canvasWidth,
            canvasHeight,
            {
              position: this.positionBuffer as WebGLBuffer,
              texcoord: this.compTexCoordBuffer as WebGLBuffer,
            }
          )
          if (out) {
            prev = out
            lastTexture = out
          }
        }
      }
    } catch {}

    return lastTexture
  }

  compositeLayers(
    baseTexture: WebGLTexture,
    topTexture: WebGLTexture,
    blendMode: BlendMode,
    opacity: number,
    canvasWidth: number,
    canvasHeight: number
  ): WebGLTexture | null {
    if (!this.gl || !this.passGraph || !this.shaderManagerV2) return null

    const tex = this.passGraph.runSingle(
      {
        shaderName: "compositor",
        uniforms: {
          u_blendMode: BLEND_MODE_MAP[blendMode],
          u_opacity: opacity,
        },
        channels: { u_baseTexture: baseTexture, u_topTexture: topTexture },
        targetFboName: "result",
      },
      canvasWidth,
      canvasHeight,
      {
        position: this.positionBuffer as WebGLBuffer,
        texcoord: this.compTexCoordBuffer as WebGLBuffer,
      }
    )

    return tex
  }

  // Helper method to copy a texture to a specific FBO
  private copyTextureToFBO(texture: WebGLTexture, fboName: string): void {
    if (!this.gl) return

    const fbo = this.fboManager.getFBO(fboName)
    if (!fbo) {
      console.error(`FBO ${fboName} not found`)
      return
    }

    // Check for feedback loop - don't copy if the texture is the same as the FBO texture
    if (texture === fbo.texture) {
      console.warn(
        `Attempting to copy texture to itself (${fboName}), skipping copy operation`
      )
      return
    }

    // Bind the target FBO
    this.fboManager.bindFBO(fboName)
    this.fboManager.clearFBO(fboName, 0, 0, 0, 0)

    // Create a simple shader program to copy texture
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)
    if (!vertexShader) return
    this.gl.shaderSource(
      vertexShader,
      `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `
    )
    this.gl.compileShader(vertexShader)

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)
    if (!fragmentShader) return
    this.gl.shaderSource(
      fragmentShader,
      `
      precision highp float;
      uniform sampler2D u_image;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `
    )
    this.gl.compileShader(fragmentShader)

    const program = this.gl.createProgram()
    if (!program) return
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    // Use simple program
    // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
    this.gl.useProgram(program)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(program, "a_position")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Simple copy should sample from source texture; treat as FBO sampling -> comp texcoords
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.compTexCoordBuffer as WebGLBuffer
    )
    const texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord")
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Bind the source texture
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    const samplerLocation = this.gl.getUniformLocation(program, "u_image")
    if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  // Method to composite layers using ping-pong FBOs to avoid feedback loops
  private compositeLayersWithPingPong(
    inputFBO: string,
    topTexture: WebGLTexture,
    outputFBO: string,
    blendMode: BlendMode,
    opacity: number,
    canvasWidth: number,
    canvasHeight: number,
    currentLayer?: any
  ): WebGLTexture | null {
    if (!this.gl || !this.compositingProgram) return null

    // Get input FBO texture to check for feedback loops
    const inputFBOObj = this.fboManager.getFBO(inputFBO)
    if (!inputFBOObj) {
      console.error(`Input FBO ${inputFBO} not found`)
      return null
    }

    // Get output FBO to check for feedback loops
    const outputFBOObj = this.fboManager.getFBO(outputFBO)
    if (!outputFBOObj) {
      console.error(`Output FBO ${outputFBO} not found`)
      return null
    }

    // Prevent feedback loops by ensuring we're not reading from and writing to the same texture
    if (
      inputFBOObj.texture === topTexture ||
      outputFBOObj.texture === topTexture
    ) {
      console.warn("Attempting to composite with feedback loop, skipping")
      return inputFBOObj.texture
    }

    // Bind output FBO for compositing
    this.fboManager.bindFBO(outputFBO)
    this.fboManager.clearFBO(outputFBO, 0, 0, 0, 0)

    // Use compositing program
    // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
    this.gl.useProgram(this.compositingProgram)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(
      this.compositingProgram,
      "a_position"
    )
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Ping-pong compositing uses FBO sampling
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.compTexCoordBuffer as WebGLBuffer
    )
    const texCoordLocation = this.gl.getAttribLocation(
      this.compositingProgram,
      "a_texCoord"
    )
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Set uniforms
    const blendModeLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_blendMode"
    )
    if (blendModeLocation) {
      // v2 compositor expects float, cast to int in shader
      this.gl.uniform1f(
        blendModeLocation,
        BLEND_MODE_MAP[blendMode] as unknown as number
      )
    }

    const opacityLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_opacity"
    )
    if (opacityLocation) {
      this.gl.uniform1f(opacityLocation, opacity)
    }

    const resolutionLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_resolution"
    )
    if (resolutionLocation) {
      this.gl.uniform2f(resolutionLocation, canvasWidth, canvasHeight)
    }

    // Bind input FBO texture as base texture

    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, inputFBOObj.texture)
    const baseSamplerLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_baseTexture"
    )
    if (baseSamplerLocation) this.gl.uniform1i(baseSamplerLocation, 0)

    // Bind top texture
    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, topTexture)
    const topSamplerLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_topTexture"
    )
    if (topSamplerLocation) this.gl.uniform1i(topSamplerLocation, 1)

    // Optional mask from current layer
    const maskTex = this.getOrCreateMaskTexture(currentLayer)
    const hasMaskLoc = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_hasMask"
    )
    if (hasMaskLoc) this.gl.uniform1f(hasMaskLoc, maskTex ? 1 : 0)
    if (maskTex) {
      this.gl.activeTexture(this.gl.TEXTURE2)
      this.gl.bindTexture(this.gl.TEXTURE_2D, maskTex)
      const maskLoc = this.gl.getUniformLocation(
        this.compositingProgram,
        "u_maskTexture"
      )
      if (maskLoc) this.gl.uniform1i(maskLoc, 2)
      // Bind mask parameters if available: invert, feather, opacity, mode
      try {
        const m = (currentLayer as any)?.mask || {}
        const invert = m.invert ? 1 : 0
        const feather = typeof m.feather === "number" ? m.feather : 0
        const mOpacity = typeof m.opacity === "number" ? m.opacity : 1
        const modeStr = String(m.mode || "add")
        const mode =
          modeStr === "subtract"
            ? 1
            : modeStr === "intersect"
              ? 2
              : modeStr === "difference"
                ? 3
                : 0
        const maskParamsLoc = this.gl.getUniformLocation(
          this.compositingProgram,
          "u_maskParams"
        )
        if (maskParamsLoc)
          this.gl.uniform4f(maskParamsLoc, invert, feather, mOpacity, mode)
      } catch {}
    }

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the output FBO texture
    if (outputFBOObj) {
      return outputFBOObj.texture
    }
    return null
  }

  // Helper method to check if an FBO is empty (heuristic):
  // Avoid readPixels on FP16 FBOs; rely on tracked usage instead.
  private isFBOEmpty(_fbo: FBO): boolean {
    // Heuristic disabled: we now trust compositing path to produce output when layers exist
    // and avoid costly/incompatible readbacks on FP16 targets.
    return false
  }

  private hexToRgba01(hex: string): [number, number, number, number] | null {
    const m = hex.replace(/^#/, "").toLowerCase()
    if (m.length === 3) {
      const r = Number.parseInt(m[0] + m[0], 16)
      const g = Number.parseInt(m[1] + m[1], 16)
      const b = Number.parseInt(m[2] + m[2], 16)
      return [r / 255, g / 255, b / 255, 1]
    }
    if (m.length === 4) {
      const r = Number.parseInt(m[0] + m[0], 16)
      const g = Number.parseInt(m[1] + m[1], 16)
      const b = Number.parseInt(m[2] + m[2], 16)
      const a = Number.parseInt(m[3] + m[3], 16)
      return [r / 255, g / 255, b / 255, a / 255]
    }
    if (m.length === 6) {
      const r = Number.parseInt(m.slice(0, 2), 16)
      const g = Number.parseInt(m.slice(2, 4), 16)
      const b = Number.parseInt(m.slice(4, 6), 16)
      return [r / 255, g / 255, b / 255, 1]
    }
    if (m.length === 8) {
      const r = Number.parseInt(m.slice(0, 2), 16)
      const g = Number.parseInt(m.slice(2, 4), 16)
      const b = Number.parseInt(m.slice(4, 6), 16)
      const a = Number.parseInt(m.slice(6, 8), 16)
      return [r / 255, g / 255, b / 255, a / 255]
    }
    return null
  }

  renderToCanvas(canvas: HTMLCanvasElement): void {
    if (!this.gl) return

    // Disable blending to eliminate that variable
    this.gl.disable(this.gl.BLEND)

    // Bind default framebuffer
    this.fboManager.bindDefaultFramebuffer()
    this.gl.viewport(0, 0, canvas.width, canvas.height)

    // Clear canvas
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    // Create a simple WebGL2 shader program for direct display
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)
    if (!vertexShader) return
    this.gl.shaderSource(
      vertexShader,
      `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`
    )
    this.gl.compileShader(vertexShader)

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)
    if (!fragmentShader) return
    this.gl.shaderSource(
      fragmentShader,
      `#version 300 es
precision highp float;
uniform sampler2D u_image;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
  outColor = texture(u_image, v_texCoord);
}
`
    )
    this.gl.compileShader(fragmentShader)

    const program = this.gl.createProgram()
    if (!program) return
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    // Use simple program
    // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
    this.gl.useProgram(program)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(program, "a_position")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Direct render to canvas samples the result FBO texture; use comp texcoords
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.compTexCoordBuffer as WebGLBuffer
    )
    const texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord")
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Check for final result in result FBO first, then ping/pong
    let finalFBO = this.fboManager.getFBO("result")

    // If result FBO is empty or doesn't exist, check ping/pong FBOs
    if (!finalFBO || this.isFBOEmpty(finalFBO)) {
      const pingFBO = this.fboManager.getFBO("ping")
      const pongFBO = this.fboManager.getFBO("pong")

      // Use whichever FBO has data, preferring ping
      if (pingFBO && !this.isFBOEmpty(pingFBO)) {
        finalFBO = pingFBO
      } else if (pongFBO && !this.isFBOEmpty(pongFBO)) {
        finalFBO = pongFBO
      }
    }

    // Only draw if we have a valid FBO with content
    if (finalFBO && !this.isFBOEmpty(finalFBO)) {
      this.gl.activeTexture(this.gl.TEXTURE0)
      this.gl.bindTexture(this.gl.TEXTURE_2D, finalFBO.texture)
      const samplerLocation = this.gl.getUniformLocation(program, "u_image")
      if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

      // Draw
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  // Helper method to flatten grouped layers into a single array for rendering
  private flattenLayersForRendering(layers: Layer[]): Layer[] {
    const flattened: Layer[] = []

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
              flattened.push(...this.flattenLayersForRendering([child]))
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

  // Reset all render state to prevent stale data from previous renders
  private resetRenderState(): void {
    if (!this.gl) return

    try {
      if (isDebug) {
        console.debug("🎨 [HybridRenderer] Resetting render state")
      }

      // Clear core framebuffers
      this.fboManager.clearFBO("temp", 0, 0, 0, 0)
      this.fboManager.clearFBO("ping", 0, 0, 0, 0)
      this.fboManager.clearFBO("pong", 0, 0, 0, 0)
      this.fboManager.clearFBO("result", 0, 0, 0, 0)

      // Clear mask textures cache
      this.maskTextures.clear()
      this.pendingMaskDecodes.clear()

      // Reset color space flag
      this.colorSpaceFlag = 0

      if (isDebug) {
        console.debug("🎨 [HybridRenderer] Render state reset complete")
      }
    } catch (error) {
      // Silently handle any errors during reset
      console.warn("Error during render state reset:", error)
    }
  }

  // Method to render all layers with proper compositing using layer-specific FBOs
  renderLayers(
    layers: Layer[],
    layerTextures: Map<string, WebGLTexture>,
    toolsValues: ImageEditorToolsState,
    selectedLayerId: string,
    canvasWidth: number,
    canvasHeight: number,
    layerDimensions?: Map<
      string,
      { width: number; height: number; x: number; y: number }
    >,
    globalLayers?: Array<{
      id: string
      type: "adjustment" | "solid" | "mask"
      adjustmentType?: string
      parameters?: Record<string, any>
      color?: [number, number, number, number]
      enabled?: boolean
      inverted?: boolean
      visible: boolean
      opacity: number
      blendMode: string
    }>,
    globalParameters?: Record<
      string,
      number | { value: number; color: string }
    >,
    playheadTime?: number
  ): void {
    if (!this.gl || !this.shaderManagerV2 || !this.compositingProgram) {
      return
    }

    // Reset all state at the start of each frame to avoid any stale
    // contents leaking between renders (e.g., after global layer deletion)
    this.resetRenderState()

    const withDefaults = (
      tv: ImageEditorToolsState | undefined
    ): ImageEditorToolsState => ({ ...(tv || {}) }) as ImageEditorToolsState

    // Apply global parameters to tool values
    const applyGlobalParameters = (
      baseTools: ImageEditorToolsState
    ): ImageEditorToolsState => {
      if (!globalParameters) return baseTools

      const result = { ...baseTools }
      for (const [key, value] of Object.entries(globalParameters)) {
        const numValue = typeof value === "number" ? value : value.value
        // Apply global parameters as multipliers or additive values based on the parameter type
        if (
          key === "brightness" ||
          key === "contrast" ||
          key === "saturation"
        ) {
          // These are typically percentage-based, so multiply
          ;(result as any)[key] =
            ((result as any)[key] as number) * (numValue / 100)
        } else if (
          key === "exposure" ||
          key === "gamma" ||
          key === "hue" ||
          key === "temperature"
        ) {
          // These are additive
          ;(result as any)[key] = ((result as any)[key] as number) + numValue
        } else {
          // For other parameters, just set the value
          ;(result as any)[key] = numValue
        }
      }
      return result
    }

    // Respect groups: handle precomp at render-time; order bottom->top
    const orderedLayers = layers
      .filter((l) => l.visible && l.opacity > 0)
      .slice()
      .reverse()

    if (orderedLayers.length === 0) {
      // Clear all FBOs when no layers are visible
      this.fboManager.clearFBO("ping", 0, 0, 0, 0)
      this.fboManager.clearFBO("pong", 0, 0, 0, 0)
      this.fboManager.clearFBO("temp", 0, 0, 0, 0)
      this.fboManager.clearFBO("result", 0, 0, 0, 0)
      return
    }

    // Start with a transparent base
    let accumulatedTexture: WebGLTexture | null = null
    let usePing = true // Track which FBO to use for output

    for (const layer of orderedLayers as any[]) {
      const type = layer?.type

      if (type === "image") {
        const layerTexture = layerTextures.get(layer.id)
        if (!layerTexture) {
          continue
        }

        // Base tools for this image layer: start with safe defaults and merge
        // - effect-type keys from image filters
        // - orientation keys from image filters (so non-selected layers keep their own transforms)
        const EFFECT_KEYS: Array<keyof Partial<ImageEditorToolsState>> = [
          "blur",
          "noise",
        ]
        const ORIENTATION_KEYS: Array<keyof Partial<ImageEditorToolsState>> = [
          "flipHorizontal",
          "flipVertical",
          "rotate",
          "scale",
        ]
        const layerToolsValues = applyGlobalParameters(withDefaults(undefined))
        const rawFilters =
          (layer.filters as Partial<ImageEditorToolsState>) || {}
        // Always sample from tracks; no static fallbacks here
        const { sampleToolsAtTimeMemoized } =
          require("@/lib/animation/sampler") as any
        // Filter to canonical Tracks only before sampling (exclude UI keys like 'zoom')
        const canon = require("@/lib/animation/crud") as any
        const tracksOnly = Object.fromEntries(
          Object.entries(rawFilters as any).filter(([, v]) =>
            canon.isCanonicalTrack(v)
          )
        )
        const imgFilters = sampleToolsAtTimeMemoized(
          tracksOnly as any,
          typeof playheadTime === "number" ? playheadTime : 0
        ) as Partial<ImageEditorToolsState>
        for (const k of EFFECT_KEYS) {
          if ((imgFilters as any)[k] !== undefined) {
            ;(layerToolsValues as any)[k] = (imgFilters as any)[k]
          }
        }

        // If this is the selected layer, merge in interactive toolsValues (e.g., flips/rotate/zoom)
        if (layer.id === selectedLayerId) {
          const selectedDefaults = withDefaults(toolsValues)
          const INTERACTIVE_KEYS: Array<keyof Partial<ImageEditorToolsState>> =
            ["flipHorizontal", "flipVertical", "rotate", "scale", "zoom"]
          for (const k of INTERACTIVE_KEYS) {
            ;(layerToolsValues as any)[k] = (selectedDefaults as any)[k]
          }
        } else {
          // For non-selected layers, preserve their own orientation (rotate/flip/scale) from filters
          for (const k of ORIENTATION_KEYS) {
            ;(layerToolsValues as any)[k] = (imgFilters as any)[k]
          }
        }

        // Render this image layer content at full opacity
        const renderedLayerTexture = this.renderLayer(
          layer,
          layerTexture,
          layerToolsValues,
          canvasWidth,
          canvasHeight,
          layerDimensions
        )

        if (!renderedLayerTexture) {
          continue
        }

        // If this is the first layer (bottom layer), store it in an FBO as the base
        if (accumulatedTexture === null) {
          this.copyTextureToFBO(renderedLayerTexture, "ping")
          accumulatedTexture =
            this.fboManager.getFBO("ping")?.texture || renderedLayerTexture
          usePing = true
        } else {
          // Composite this layer over the accumulated result using its blend mode and opacity
          const outputFBO = usePing ? "ping" : "pong"
          const inputFBO = usePing ? "pong" : "ping"

          const inputFBOObj = this.fboManager.getFBO(inputFBO)
          const outputFBOObj = this.fboManager.getFBO(outputFBO)

          if (this.fboManager.isTextureBoundToFBO(accumulatedTexture)) {
            const sourceFBO =
              this.fboManager.getFBOByTexture(accumulatedTexture)
            if (sourceFBO && sourceFBO !== inputFBO) {
              this.copyTextureToFBO(accumulatedTexture, inputFBO)
            }
          } else if (
            !inputFBOObj ||
            accumulatedTexture !== inputFBOObj.texture
          ) {
            this.copyTextureToFBO(accumulatedTexture, inputFBO)
          }

          if (
            inputFBOObj &&
            outputFBOObj &&
            (renderedLayerTexture === inputFBOObj.texture ||
              renderedLayerTexture === outputFBOObj.texture)
          ) {
            console.warn(
              "Feedback loop detected in layer compositing, skipping layer"
            )
            continue
          }

          const compositedTexture = this.compositeLayersWithPingPong(
            inputFBO,
            renderedLayerTexture,
            outputFBO,
            layer.blendMode,
            layer.opacity,
            canvasWidth,
            canvasHeight,
            layer
          )

          if (compositedTexture) {
            accumulatedTexture = compositedTexture
            usePing = !usePing
          }
        }
      } else if (type === "group") {
        // Precompose group into temp FBO, then composite as a single layer
        // Children should draw bottom->top to match PS/AE
        const groupChildren: Layer[] = Array.isArray(layer.children)
          ? (layer.children as Layer[])
          : []
        const childrenOrdered = groupChildren.slice().reverse()
        if (groupChildren.length === 0) continue
        // Render children recursively into dedicated group ping/pong to avoid conflicts
        const grpPing = `grp:${(layer as any).id}:ping`
        const grpPong = `grp:${(layer as any).id}:pong`
        const grpTemp = `grp:${(layer as any).id}:temp`
        // Ensure FBOs exist
        this.fboManager.createFBO(canvasWidth, canvasHeight, grpPing)
        this.fboManager.createFBO(canvasWidth, canvasHeight, grpPong)
        this.fboManager.createFBO(canvasWidth, canvasHeight, grpTemp)
        let groupAccum: WebGLTexture | null = null
        let grpUsePing = true
        // Render children bottom->top
        for (const child of childrenOrdered) {
          if (!child.visible || child.opacity <= 0) continue
          if (child.type === "image") {
            const childTex = layerTextures.get(child.id)
            if (!childTex) continue
            const childRendered = this.renderLayer(
              child as any,
              childTex,
              withDefaults(undefined),
              canvasWidth,
              canvasHeight,
              layerDimensions
            )
            if (!childRendered) continue
            if (!groupAccum) {
              this.copyTextureToFBO(childRendered, grpPing)
              groupAccum =
                this.fboManager.getFBO(grpPing)?.texture || childRendered
              grpUsePing = true
            } else {
              const outFbo = grpUsePing ? grpPing : grpPong
              const inFbo = grpUsePing ? grpPong : grpPing
              const inObj = this.fboManager.getFBO(inFbo)
              if (!inObj || inObj.texture !== groupAccum) {
                this.copyTextureToFBO(groupAccum, inFbo)
              }
              const composed = this.compositeLayersWithPingPong(
                inFbo,
                childRendered,
                outFbo,
                child.blendMode,
                child.opacity,
                canvasWidth,
                canvasHeight
              )
              if (composed) {
                groupAccum = composed
                grpUsePing = !grpUsePing
              }
            }
          } else if (child.type === "adjustment") {
            if (!groupAccum) continue
            const adjParams = (child as any).parameters || {}
            const adjTexture = this.renderAdjustmentToTexture(
              groupAccum,
              withDefaults(adjParams),
              canvasWidth,
              canvasHeight
            )
            if (!adjTexture) continue
            const outFbo = grpUsePing ? grpPing : grpPong
            const inFbo = grpUsePing ? grpPong : grpPing
            const inObj = this.fboManager.getFBO(inFbo)
            if (!inObj || inObj.texture !== groupAccum) {
              this.copyTextureToFBO(groupAccum, inFbo)
            }
            const composed = this.compositeLayersWithPingPong(
              inFbo,
              adjTexture,
              outFbo,
              child.blendMode,
              child.opacity,
              canvasWidth,
              canvasHeight
            )
            if (composed) {
              groupAccum = composed
              grpUsePing = !grpUsePing
            }
          }
        }
        if (!groupAccum) continue
        // Now composite the group as a single layer over the accumulated result
        if (accumulatedTexture === null) {
          this.copyTextureToFBO(groupAccum, "ping")
          accumulatedTexture =
            this.fboManager.getFBO("ping")?.texture || groupAccum
          usePing = true
        } else {
          const outFbo = usePing ? "ping" : "pong"
          const inFbo = usePing ? "pong" : "ping"
          const inObj = this.fboManager.getFBO(inFbo)
          if (!inObj || inObj.texture !== accumulatedTexture) {
            this.copyTextureToFBO(accumulatedTexture, inFbo)
          }
          const composed = this.compositeLayersWithPingPong(
            inFbo,
            groupAccum,
            outFbo,
            layer.blendMode,
            layer.opacity,
            canvasWidth,
            canvasHeight
          )
          if (composed) {
            accumulatedTexture = composed
            usePing = !usePing
          }
          // restore pre-group state marker (no separate stack needed since we use local vars)
        }
      } else if (type === "adjustment") {
        if (accumulatedTexture === null) continue

        const adjustmentParams = (layer.parameters || {}) as Record<string, any>
        let mapped: Record<string, any> = {}
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const reg = require("@/lib/adjustments/registry")
          mapped = reg.mapParametersToShader(
            layer.adjustmentType as any,
            adjustmentParams
          ) as Record<string, any>
          try {
            const canon = require("@/lib/animation/crud") as any
            const { sampleToolsAtTimeMemoized } =
              require("@/lib/animation/sampler") as any
            const onlyTracks = Object.fromEntries(
              Object.entries(mapped).filter(([, v]) =>
                canon.isCanonicalTrack(v)
              )
            )
            if (Object.keys(onlyTracks).length > 0) {
              const t = typeof playheadTime === "number" ? playheadTime : 0
              const sampled = sampleToolsAtTimeMemoized(onlyTracks, t)
              mapped = { ...mapped, ...sampled }
            }
          } catch {}
        } catch {}

        const adjustedTexture = this.renderAdjustmentLayerToTexture(
          accumulatedTexture,
          String((layer as any).adjustmentType || ""),
          mapped,
          canvasWidth,
          canvasHeight
        )

        if (!adjustedTexture) {
          continue
        }

        // Composite adjusted result over the base using the adjustment layer's blend + opacity
        const outputFBO = usePing ? "ping" : "pong"
        const inputFBO = usePing ? "pong" : "ping"

        // Copy accumulated base into input FBO only if different
        const inputObj = this.fboManager.getFBO(inputFBO)
        if (!inputObj || inputObj.texture !== accumulatedTexture) {
          this.copyTextureToFBO(accumulatedTexture, inputFBO)
        }

        const compositedTexture = this.compositeLayersWithPingPong(
          inputFBO,
          adjustedTexture,
          outputFBO,
          layer.blendMode,
          layer.opacity,
          canvasWidth,
          canvasHeight
        )

        if (compositedTexture) {
          accumulatedTexture = compositedTexture
          usePing = !usePing
        }
      }
    }

    // Apply global layers to the accumulated result
    if (globalLayers && globalLayers.length > 0 && accumulatedTexture) {
      // Debug: log global layers being processed
      if (isDebug) {
        console.debug(
          "🎨 [HybridRenderer] Processing global layers:",
          globalLayers.map((l) => ({
            id: l.id,
            type: l.type,
            visible: l.visible,
          }))
        )
      }

      // Process global layers in order (top to bottom, so reverse the array)
      const orderedGlobalLayers = globalLayers
        .filter((l) => l.visible && l.opacity > 0)
        .slice()
        .reverse()

      for (const globalLayer of orderedGlobalLayers) {
        if (globalLayer.type === "adjustment") {
          const adjustmentParams = (globalLayer.parameters || {}) as Record<
            string,
            any
          >
          let mapped: Record<string, any> = {}
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const reg = require("@/lib/adjustments/registry")
            mapped = reg.mapParametersToShader(
              globalLayer.adjustmentType as any,
              adjustmentParams
            ) as Record<string, any>
            try {
              const canon = require("@/lib/animation/crud") as any
              const { sampleToolsAtTimeMemoized } =
                require("@/lib/animation/sampler") as any
              const onlyTracks = Object.fromEntries(
                Object.entries(mapped).filter(([, v]) =>
                  canon.isCanonicalTrack(v)
                )
              )
              if (Object.keys(onlyTracks).length > 0) {
                const t = typeof playheadTime === "number" ? playheadTime : 0
                const sampled = sampleToolsAtTimeMemoized(onlyTracks, t)
                mapped = { ...mapped, ...sampled }
              }
            } catch {}
          } catch {}

          const adjustedTexture = this.renderAdjustmentLayerToTexture(
            accumulatedTexture,
            String((globalLayer as any).adjustmentType || ""),
            mapped,
            canvasWidth,
            canvasHeight
          )

          if (!adjustedTexture) {
            continue
          }

          // Composite adjusted result over the base using the global layer's blend + opacity
          const outputFBO = usePing ? "ping" : "pong"
          const inputFBO = usePing ? "pong" : "ping"

          // Copy accumulated base into input FBO only if different
          const inputObj = this.fboManager.getFBO(inputFBO)
          if (!inputObj || inputObj.texture !== accumulatedTexture) {
            this.copyTextureToFBO(accumulatedTexture, inputFBO)
          }

          const compositedTexture = this.compositeLayersWithPingPong(
            inputFBO,
            adjustedTexture,
            outputFBO,
            globalLayer.blendMode as any,
            globalLayer.opacity,
            canvasWidth,
            canvasHeight
          )

          if (compositedTexture) {
            accumulatedTexture = compositedTexture
            usePing = !usePing
          }
        } else if (globalLayer.type === "solid") {
          // Create a solid color texture and composite it
          const solidTexture = this.createSolidColorTexture(
            globalLayer.color || [1, 1, 1, 1],
            canvasWidth,
            canvasHeight
          )

          if (solidTexture) {
            const outputFBO = usePing ? "ping" : "pong"
            const inputFBO = usePing ? "pong" : "ping"

            // Copy accumulated base into input FBO only if different
            const inputObj = this.fboManager.getFBO(inputFBO)
            if (!inputObj || inputObj.texture !== accumulatedTexture) {
              this.copyTextureToFBO(accumulatedTexture, inputFBO)
            }

            const compositedTexture = this.compositeLayersWithPingPong(
              inputFBO,
              solidTexture,
              outputFBO,
              globalLayer.blendMode as any,
              globalLayer.opacity,
              canvasWidth,
              canvasHeight
            )

            if (compositedTexture) {
              accumulatedTexture = compositedTexture
              usePing = !usePing
            }
          }
        }
        // Note: Mask layers would be implemented here when needed
      }
    }

    // Store the final result in the result FBO
    if (accumulatedTexture) {
      const finalFBO = usePing ? "ping" : "pong"
      const finalFBOObj = this.fboManager.getFBO(finalFBO)

      // Only copy if the accumulated texture is not already the final FBO texture
      if (accumulatedTexture !== finalFBOObj?.texture) {
        // Check if we're trying to copy an FBO texture
        if (this.fboManager.isTextureBoundToFBO(accumulatedTexture)) {
          const sourceFBO = this.fboManager.getFBOByTexture(accumulatedTexture)
          if (sourceFBO && sourceFBO !== finalFBO) {
            this.copyTextureToFBO(accumulatedTexture, "result")
          } else {
            // Copy from ping/pong to result FBO
            this.copyTextureToFBO(accumulatedTexture, "result")
          }
        } else {
          // Regular texture, safe to copy
          this.copyTextureToFBO(accumulatedTexture, "result")
        }
      } else {
        // Copy from ping/pong to result FBO
        this.copyTextureToFBO(accumulatedTexture, "result")
      }
    }
  }

  /**
   * Create a solid color texture for global solid layers
   */
  private createSolidColorTexture(
    color: [number, number, number, number],
    width: number,
    height: number
  ): WebGLTexture | null {
    if (!this.gl) return null

    const texture = this.gl.createTexture()
    if (!texture) return null

    // Create a 1x1 pixel with the solid color
    const pixelData = new Uint8Array([
      Math.round(color[0] * 255),
      Math.round(color[1] * 255),
      Math.round(color[2] * 255),
      Math.round(color[3] * 255),
    ])

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      1,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      pixelData
    )
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    )
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    )
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    )
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    )
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)

    return texture
  }

  cleanup(): void {
    if (!this.gl) return

    // Clean up programs
    // No legacy shader manager
    if (this.compositingProgram) {
      this.gl.deleteProgram(this.compositingProgram)
      this.compositingProgram = null
    }

    // Clean up buffers
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer)
      this.positionBuffer = null
    }
    if (this.layerTexCoordBuffer) {
      this.gl.deleteBuffer(this.layerTexCoordBuffer)
      this.layerTexCoordBuffer = null
    }
    if (this.compTexCoordBuffer) {
      this.gl.deleteBuffer(this.compTexCoordBuffer)
      this.compTexCoordBuffer = null
    }

    // Clean up textures
    if (this.layerTexture) {
      this.gl.deleteTexture(this.layerTexture)
      this.layerTexture = null
    }
    if (this.compositingTexture) {
      this.gl.deleteTexture(this.compositingTexture)
      this.compositingTexture = null
    }

    // Clean up FBO manager
    this.fboManager.cleanup()

    this.gl = null
  }
}
