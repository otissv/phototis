import {
  FBOManager,
  type FBO,
  type LayerFBO,
  type LayerBounds,
} from "./fbo-manager"
import { BLEND_MODE_MAP } from "./blend-modes/blend-modes"
import type { BlendMode } from "./blend-modes/types.blend"
import {
  COMPOSITING_VERTEX_SHADER,
  COMPOSITING_FRAGMENT_SHADER,
  LAYER_RENDER_FRAGMENT_SHADER,
} from "./compositing-shader"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import type { EditorLayer as Layer } from "@/lib/editor/state"
import { ShaderManager } from "."
import { RenderConfig } from "./render-config"

export interface HybridRendererOptions {
  width: number
  height: number
  gl: WebGL2RenderingContext
}

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
  // Plugin-based shader manager (modular shader system)
  private shaderManager: ShaderManager | null = null
  // Position buffer for plugin vertex shader (expects [0..1] quad)
  private pluginPositionBuffer: WebGLBuffer | null = null

  constructor() {
    this.fboManager = new FBOManager()
  }

  initialize(options: HybridRendererOptions): boolean {
    const { gl, width, height } = options
    this.gl = gl
    this.width = width
    this.height = height

    // Configure WebGL with centralized settings
    RenderConfig.configureWebGL(gl)

    // Debug: Log HybridRenderer initialization
    console.log("HybridRenderer initialized:", {
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

    // Initialize modular ShaderManager for layer rendering via plugins
    this.shaderManager = new ShaderManager()
    const shaderInitOk = this.shaderManager.initialize(gl)

    // Compile compositing program (blend modes)
    this.compositingProgram = this.compileProgram(
      COMPOSITING_VERTEX_SHADER,
      COMPOSITING_FRAGMENT_SHADER
    )

    if (!shaderInitOk || !this.compositingProgram) {
      console.error("Failed to compile shader programs:", {
        shaderManager: shaderInitOk,
        compositingProgram: !!this.compositingProgram,
      })
      return false
    }

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

  private compileProgram(
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram | null {
    if (!this.gl) return null

    // Create and compile vertex shader
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)
    if (!vertexShader) {
      console.error("Failed to create vertex shader")
      return null
    }
    this.gl.shaderSource(vertexShader, vertexSource)
    this.gl.compileShader(vertexShader)

    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(vertexShader)
      console.error("Vertex shader compilation failed:", error)
      console.error("Vertex shader source:", vertexSource)
      return null
    }

    // Create and compile fragment shader
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)
    if (!fragmentShader) {
      console.error("Failed to create fragment shader")
      return null
    }
    this.gl.shaderSource(fragmentShader, fragmentSource)
    this.gl.compileShader(fragmentShader)

    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(fragmentShader)
      console.error("Fragment shader compilation failed:", error)
      console.error("Fragment shader source:", fragmentSource)
      return null
    }

    // Create and link program
    const program = this.gl.createProgram()
    if (!program) {
      console.error("Failed to create program")
      return null
    }
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program)
      console.error("Program linking failed:", error)
      return null
    }

    return program
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
    if (!this.gl || !this.shaderManager) return null

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

    // Use plugin-based program
    const program = this.shaderManager.getProgram()
    if (!program) return null
    this.gl.useProgram(program)

    // Set up attributes from shared buffers
    const positionLocation = this.gl.getAttribLocation(program, "a_position")
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.pluginPositionBuffer as WebGLBuffer
    )
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Layer rendering samples uploaded bitmaps
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.layerTexCoordBuffer as WebGLBuffer
    )
    const texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord")
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

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
      console.log("HybridRenderer layer:orientation", {
        layerId: (layer as any).id,
        flipVertical: flipV,
        flipHorizontal: flipH,
        rotate: rot,
        texcoordV: "normal",
        orientation: finalOrient,
        unpackFlipY: this.gl.getParameter(this.gl.UNPACK_FLIP_Y_WEBGL),
      })
    } catch {}

    // Bind layer texture
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, layerTexture)
    const samplerLocation = this.gl.getUniformLocation(program, "u_image")
    if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

    // Build uniforms for plugin-based program
    const layerCenterX = layerX + layerWidth / 2
    const layerCenterY = layerY + layerHeight / 2
    // Normalize recolor: accept number or { value, color }
    let recolorAmount = 0
    let recolorColor: [number, number, number] | null = null
    const recolorAny: any = (toolsValues as any).recolor
    if (typeof recolorAny === "number") {
      recolorAmount = recolorAny
      recolorColor = [1, 0, 0]
    } else if (
      recolorAny &&
      typeof recolorAny === "object" &&
      typeof recolorAny.value === "number"
    ) {
      recolorAmount = recolorAny.value
      const hex =
        typeof recolorAny.color === "string" ? recolorAny.color : "#000000"
      const rgba = this.hexToRgba01(hex) || [0, 0, 0, 1]
      recolorColor = [rgba[0], rgba[1], rgba[2]]
    }

    const uniformsUpdate: Record<string, any> = {
      ...(toolsValues as any),
      // enforce numeric recolor amount for plugin uniform
      recolor: recolorAmount,
      u_opacity: 100,
      layerSize: [layerWidth, layerHeight],
      canvasSize: [canvasWidth, canvasHeight],
      layerPosition: [layerCenterX, layerCenterY],
      u_resolution: [canvasWidth, canvasHeight],
    }
    if (recolorColor) uniformsUpdate.u_recolorColor = recolorColor

    this.shaderManager.updateUniforms(uniformsUpdate)
    this.shaderManager.setUniforms(this.gl, program)

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the rendered texture from the temp FBO
    return tempFBO.texture
  }

  // Render an adjustment layer by applying its parameters to the current accumulated texture
  // This produces a full-canvas texture that represents the adjusted result of the base
  private renderAdjustmentToTexture(
    baseTexture: WebGLTexture,
    adjustmentTools: ImageEditorToolsState,
    canvasWidth: number,
    canvasHeight: number
  ): WebGLTexture | null {
    if (!this.gl || !this.shaderManager) return null

    // Use temp FBO as output target
    const tempFBO = this.fboManager.getFBO("temp")
    if (!tempFBO) return null

    // Bind temp FBO and clear
    this.fboManager.bindFBO("temp")
    this.fboManager.clearFBO("temp", 0, 0, 0, 0)

    // Use the same plugin-based program, but sample from the base texture and use full-canvas dims
    const program = this.shaderManager.getProgram()
    if (!program) return null
    this.gl.useProgram(program)

    const positionLocation = this.gl.getAttribLocation(program, "a_position")
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.pluginPositionBuffer as WebGLBuffer
    )
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Adjustment samples accumulated base texture from FBO; use comp texcoords
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.compTexCoordBuffer as WebGLBuffer
    )
    const texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord")
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Bind the accumulated base texture as the image source
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, baseTexture)
    const samplerLocation = this.gl.getUniformLocation(program, "u_image")
    if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

    // For adjustment rendering, use full opacity here and composite opacity later
    // Use full-canvas dimensions and center position
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    // Normalize recolor for adjustments as well
    let recolorAmount = 0
    let recolorColor: [number, number, number] | null = null
    const recolorAny: any = (adjustmentTools as any).recolor
    if (typeof recolorAny === "number") {
      recolorAmount = recolorAny
      recolorColor = [1, 0, 0]
    } else if (
      recolorAny &&
      typeof recolorAny === "object" &&
      typeof recolorAny.value === "number"
    ) {
      recolorAmount = recolorAny.value
      const hex =
        typeof recolorAny.color === "string" ? recolorAny.color : "#000000"
      const rgba = this.hexToRgba01(hex) || [0, 0, 0, 1]
      recolorColor = [rgba[0], rgba[1], rgba[2]]
    }

    const uniformsUpdate: Record<string, any> = {
      ...(adjustmentTools as any),
      recolor: recolorAmount,
      u_opacity: 100,
      layerSize: [canvasWidth, canvasHeight],
      canvasSize: [canvasWidth, canvasHeight],
      layerPosition: [centerX, centerY],
      u_resolution: [canvasWidth, canvasHeight],
    }
    if (recolorColor) uniformsUpdate.u_recolorColor = recolorColor

    this.shaderManager.updateUniforms(uniformsUpdate)
    this.shaderManager.setUniforms(this.gl, program)

    // Debug: Log adjustment orientation/texcoords
    try {
      const rotRaw = Number((adjustmentTools as any).rotate || 0)
      const rot = ((rotRaw % 360) + 360) % 360
      const flipV = Boolean((adjustmentTools as any).flipVertical)
      const flipH = Boolean((adjustmentTools as any).flipHorizontal)
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
      console.log("HybridRenderer adjustment:orientation", {
        flipVertical: flipV,
        flipHorizontal: flipH,
        rotate: rot,
        texcoordV: "normal",
        unpackFlipY: this.gl.getParameter(this.gl.UNPACK_FLIP_Y_WEBGL),
        orientation: finalOrient,
      })
    } catch {}

    // Draw fullscreen quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    return tempFBO.texture
  }

  compositeLayers(
    baseTexture: WebGLTexture,
    topTexture: WebGLTexture,
    blendMode: BlendMode,
    opacity: number,
    canvasWidth: number,
    canvasHeight: number
  ): WebGLTexture | null {
    if (!this.gl || !this.compositingProgram) return null

    // Bind result FBO for compositing
    this.fboManager.bindFBO("result")
    this.fboManager.clearFBO("result", 0, 0, 0, 0)

    // Use compositing program
    this.gl.useProgram(this.compositingProgram)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(
      this.compositingProgram,
      "a_position"
    )
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Compositing samples FBOs; use comp texcoords
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
      this.gl.uniform1i(blendModeLocation, BLEND_MODE_MAP[blendMode])
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

    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, baseTexture)
    const baseSamplerLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_baseTexture"
    )
    if (baseSamplerLocation) this.gl.uniform1i(baseSamplerLocation, 0)

    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, topTexture)
    const topSamplerLocation = this.gl.getUniformLocation(
      this.compositingProgram,
      "u_topTexture"
    )
    if (topSamplerLocation) this.gl.uniform1i(topSamplerLocation, 1)

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the composited texture
    const resultFBO = this.fboManager.getFBO("result")
    if (resultFBO) {
      return resultFBO.texture
    }
    return null
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

    // Additional check for any FBO texture that might cause feedback
    if (this.fboManager.isTextureBoundToFBO(texture)) {
      const sourceFBO = this.fboManager.getFBOByTexture(texture)
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
    canvasHeight: number
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
      this.gl.uniform1i(blendModeLocation, BLEND_MODE_MAP[blendMode])
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

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the output FBO texture
    if (outputFBOObj) {
      return outputFBOObj.texture
    }
    return null
  }

  // Helper method to check if an FBO is empty (all pixels are transparent)
  private isFBOEmpty(fbo: FBO): boolean {
    if (!this.gl) return true

    // Create a temporary framebuffer to read from the FBO texture
    const tempFramebuffer = this.gl.createFramebuffer()
    if (!tempFramebuffer) return true

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, tempFramebuffer)
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      fbo.texture,
      0
    )

    // Read multiple pixels to check for content
    const pixels = new Uint8Array(16) // 4 pixels (2x2)
    this.gl.readPixels(
      Math.floor(fbo.width / 2) - 1,
      Math.floor(fbo.height / 2) - 1,
      2,
      2,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      pixels
    )

    // Clean up
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.deleteFramebuffer(tempFramebuffer)

    // Check if any pixel has non-zero alpha
    let hasContent = false
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) {
        hasContent = true
        break
      }
    }

    return !hasContent
  }

  // Legacy: replaced by ShaderManager in this class. Keeping method removed.

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

    // Create a simple shader program for direct display
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

  // Helper method to get the rendering order (bottom -> top) consistent with layer system
  private getRenderingOrder(layers: Layer[]): Layer[] {
    // First flatten group layers to get all individual layers
    const flattenedLayers = this.flattenLayersForRendering(layers)

    // The editor provides layers in top-first order (new layers are unshifted)
    // For correct compositing we must render bottom-first, so reverse here.
    return flattenedLayers
      .filter((layer) => {
        if (!layer.visible) return false
        if (layer.opacity <= 0) return false
        if (layer.type === "image") {
          return !!(layer as any).image || !(layer as any).isEmpty
        }
        // Non-image layers are allowed (e.g., adjustment)
        return true
      })
      .slice()
      .reverse()
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
    >
  ): void {
    if (!this.gl || !this.shaderManager || !this.compositingProgram) {
      return
    }

    // Provide safe defaults for tool values to avoid undefined access
    const DEFAULT_TOOLS: Partial<ImageEditorToolsState> = {
      blur: 0,
      blurCenter: 0.5,
      blurDirection: 0,
      blurType: 0,
      brightness: 100,
      contrast: 100,
      crop: { x: 0, y: 0, width: 0, height: 0 },
      exposure: 0,
      flipHorizontal: false,
      flipVertical: false,
      gamma: 1,
      grain: 0,
      grayscale: 0,
      hue: 0,
      invert: 0,
      noise: 0,
      dimensions: { width: 0, height: 0 },
      rotate: 0,
      saturation: 100,
      scale: 1,
      sepia: 0,
      sharpen: 0,
      temperature: 0,
      upscale: 0,
      vibrance: 0,
      zoom: 100,
    } as Partial<ImageEditorToolsState>

    const withDefaults = (
      tv: ImageEditorToolsState | undefined
    ): ImageEditorToolsState =>
      ({ ...(DEFAULT_TOOLS as any), ...(tv || {}) }) as ImageEditorToolsState

    // Get layers in proper rendering order (bottom to top)
    const visibleLayers = this.getRenderingOrder(layers)

    if (visibleLayers.length === 0) {
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

    for (let i = 0; i < visibleLayers.length; i++) {
      const layer = visibleLayers[i] as any
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
          "blurType",
          "blurDirection",
          "blurCenter",
          "sharpen",
          "noise",
          "grain",
        ]
        const ORIENTATION_KEYS: Array<keyof Partial<ImageEditorToolsState>> = [
          "flipHorizontal",
          "flipVertical",
          "rotate",
          "scale",
        ]
        const layerToolsValues = withDefaults(undefined)
        const imgFilters =
          (layer.filters as Partial<ImageEditorToolsState>) || {}
        for (const k of EFFECT_KEYS) {
          if (Object.prototype.hasOwnProperty.call(imgFilters, k)) {
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
            if (Object.prototype.hasOwnProperty.call(imgFilters, k)) {
              ;(layerToolsValues as any)[k] = (imgFilters as any)[k]
            }
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
            canvasHeight
          )

          if (compositedTexture) {
            accumulatedTexture = compositedTexture
            usePing = !usePing
          }
        }
      } else if (type === "adjustment") {
        // Adjustment layers operate on the accumulated result below them
        if (accumulatedTexture === null) {
          continue
        }

        // Build tool values from adjustment parameters using plugin mapping
        const adjustmentParams = (layer.parameters || {}) as Record<string, any>
        const adjustmentTools = withDefaults(undefined)
        try {
          // dynamic require to avoid top-level await and keep main bundle small
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const reg = require("@/lib/editor/adjustments/registry")
          const mapped = reg.mapParametersToShader(
            layer.adjustmentType as any,
            adjustmentParams
          ) as Record<string, any>
          for (const [k, v] of Object.entries(mapped)) {
            ;(adjustmentTools as any)[k] = v
          }
        } catch {
          for (const [k, v] of Object.entries(adjustmentParams)) {
            ;(adjustmentTools as any)[k] = v
          }
        }

        // Render adjusted version of the base at full opacity
        const adjustedTexture = this.renderAdjustmentToTexture(
          accumulatedTexture,
          adjustmentTools,
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

  cleanup(): void {
    if (!this.gl) return

    // Clean up programs
    if (this.shaderManager) {
      this.shaderManager.cleanup()
      this.shaderManager = null
    }
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
