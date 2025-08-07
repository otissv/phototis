import { FBOManager, type FBO } from "./fbo-manager"
import { BLEND_MODE_MAP, type BlendMode } from "./blend-modes"
import {
  COMPOSITING_VERTEX_SHADER,
  COMPOSITING_FRAGMENT_SHADER,
  LAYER_RENDER_FRAGMENT_SHADER,
} from "./compositing-shader"
import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"
import type { Layer } from "@/components/image-editor/layer-system"

export interface HybridRendererOptions {
  width: number
  height: number
  gl: WebGL2RenderingContext
}

export class HybridRenderer {
  private gl: WebGL2RenderingContext | null = null
  private fboManager: FBOManager
  private layerProgram: WebGLProgram | null = null
  private compositingProgram: WebGLProgram | null = null
  private positionBuffer: WebGLBuffer | null = null
  private texCoordBuffer: WebGLBuffer | null = null
  private layerTexture: WebGLTexture | null = null
  private compositingTexture: WebGLTexture | null = null

  constructor() {
    this.fboManager = new FBOManager()
  }

  initialize(options: HybridRendererOptions): boolean {
    const { gl, width, height } = options
    this.gl = gl

    // Initialize FBO manager
    this.fboManager.initialize(gl)

    // Create FBOs for compositing - use ping-pong system to avoid feedback loops
    const tempFBO = this.fboManager.createFBO(width, height, "temp")
    const pingFBO = this.fboManager.createFBO(width, height, "ping")
    const pongFBO = this.fboManager.createFBO(width, height, "pong")
    const resultFBO = this.fboManager.createFBO(width, height, "result")

    if (!tempFBO || !pingFBO || !pongFBO || !resultFBO) {
      console.error("Failed to create FBOs")
      return false
    }

    // Compile layer rendering program
    this.layerProgram = this.compileProgram(
      COMPOSITING_VERTEX_SHADER,
      LAYER_RENDER_FRAGMENT_SHADER
    )

    // Compile compositing program
    this.compositingProgram = this.compileProgram(
      COMPOSITING_VERTEX_SHADER,
      COMPOSITING_FRAGMENT_SHADER
    )

    if (!this.layerProgram || !this.compositingProgram) {
      console.error("Failed to compile shader programs")
      return false
    }

    // Create buffers
    this.positionBuffer = gl.createBuffer()
    this.texCoordBuffer = gl.createBuffer()

    if (!this.positionBuffer || !this.texCoordBuffer) {
      console.error("Failed to create buffers")
      return false
    }

    // Set up position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )

    // Set up texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    )

    // Create textures
    this.layerTexture = gl.createTexture()
    this.compositingTexture = gl.createTexture()

    if (!this.layerTexture || !this.compositingTexture) {
      console.error("Failed to create textures")
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
    if (!vertexShader) return null
    this.gl.shaderSource(vertexShader, vertexSource)
    this.gl.compileShader(vertexShader)

    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Vertex shader compilation failed:",
        this.gl.getShaderInfoLog(vertexShader)
      )
      return null
    }

    // Create and compile fragment shader
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)
    if (!fragmentShader) return null
    this.gl.shaderSource(fragmentShader, fragmentSource)
    this.gl.compileShader(fragmentShader)

    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Fragment shader compilation failed:",
        this.gl.getShaderInfoLog(fragmentShader)
      )
      return null
    }

    // Create and link program
    const program = this.gl.createProgram()
    if (!program) return null
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(
        "Program linking failed:",
        this.gl.getProgramInfoLog(program)
      )
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
    if (!this.gl || !this.layerProgram) return null

    // Bind temp FBO for layer rendering
    this.fboManager.bindFBO("temp")
    this.fboManager.clearFBO("temp", 0, 0, 0, 0)

    // Ensure we're not reading from the same texture we're writing to
    const currentTempFBO = this.fboManager.getFBO("temp")
    if (currentTempFBO?.texture === layerTexture) {
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

    // Use layer program
    this.gl.useProgram(this.layerProgram)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(
      this.layerProgram,
      "a_position"
    )
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    const texCoordLocation = this.gl.getAttribLocation(
      this.layerProgram,
      "a_texCoord"
    )
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Get layer dimensions for positioning and cropping
    const layerDim = layerDimensions?.get(layer.id)
    const layerWidth = layerDim?.width || canvasWidth
    const layerHeight = layerDim?.height || canvasHeight
    const layerX = layerDim?.x || 0
    const layerY = layerDim?.y || 0

    // Set uniforms - treat all layers equally for proper blend mode interactions
    this.setLayerUniforms(
      toolsValues,
      layer.opacity,
      canvasWidth,
      canvasHeight,
      layerWidth,
      layerHeight,
      layerX,
      layerY
    )

    // Bind layer texture
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, layerTexture)
    const samplerLocation = this.gl.getUniformLocation(
      this.layerProgram,
      "u_image"
    )
    if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the rendered texture
    const tempFBO = this.fboManager.getFBO("temp")
    if (tempFBO) {
      return tempFBO.texture
    }
    return null
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

    const texCoordLocation = this.gl.getAttribLocation(
      this.compositingProgram,
      "a_texCoord"
    )
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
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

    const texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
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

    const texCoordLocation = this.gl.getAttribLocation(
      this.compositingProgram,
      "a_texCoord"
    )
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
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

    // Read a single pixel from the center
    const pixels = new Uint8Array(4)
    this.gl.readPixels(
      Math.floor(fbo.width / 2),
      Math.floor(fbo.height / 2),
      1,
      1,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      pixels
    )

    // Clean up
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.deleteFramebuffer(tempFramebuffer)

    // Check if the pixel is transparent (alpha = 0)
    return pixels[3] === 0
  }

  private setLayerUniforms(
    toolsValues: ImageEditorToolsState,
    opacity: number,
    canvasWidth: number,
    canvasHeight: number,
    layerWidth?: number,
    layerHeight?: number,
    layerX?: number,
    layerY?: number
  ): void {
    if (!this.gl || !this.layerProgram) return

    const uniforms = [
      { name: "u_brightness", value: toolsValues.brightness },
      { name: "u_contrast", value: toolsValues.contrast },
      { name: "u_saturation", value: toolsValues.saturation },
      { name: "u_hue", value: toolsValues.hue },
      { name: "u_exposure", value: toolsValues.exposure },
      { name: "u_temperature", value: toolsValues.temperature },
      { name: "u_gamma", value: toolsValues.gamma },
      { name: "u_blur", value: toolsValues.blur },
      { name: "u_blurType", value: toolsValues.blurType },
      { name: "u_blurDirection", value: toolsValues.blurDirection },
      { name: "u_blurCenter", value: toolsValues.blurCenter },
      { name: "u_vintage", value: toolsValues.vintage },
      { name: "u_invert", value: toolsValues.invert },
      { name: "u_sepia", value: toolsValues.sepia },
      { name: "u_grayscale", value: toolsValues.grayscale },
      { name: "u_tint", value: toolsValues.tint },
      { name: "u_vibrance", value: toolsValues.vibrance },
      { name: "u_noise", value: toolsValues.noise },
      { name: "u_grain", value: toolsValues.grain },
      { name: "u_rotate", value: toolsValues.rotate },
      { name: "u_scale", value: toolsValues.scale },
      { name: "u_flipHorizontal", value: toolsValues.flipHorizontal },
      { name: "u_flipVertical", value: toolsValues.flipVertical },
      { name: "u_opacity", value: opacity },
      { name: "u_resolution", value: [canvasWidth, canvasHeight] },
      { name: "u_layerWidth", value: layerWidth || canvasWidth },
      { name: "u_layerHeight", value: layerHeight || canvasHeight },
      { name: "u_layerX", value: layerX || 0 },
      { name: "u_layerY", value: layerY || 0 },
    ]

    uniforms.forEach(({ name, value }) => {
      if (!this.gl || !this.layerProgram) return
      const location = this.gl.getUniformLocation(this.layerProgram, name)
      if (location !== null) {
        if (typeof value === "number") {
          this.gl.uniform1f(location, value)
        } else if (typeof value === "boolean") {
          this.gl.uniform1i(location, value ? 1 : 0)
        } else if (Array.isArray(value) && value.length === 2) {
          this.gl.uniform2f(location, value[0], value[1])
        }
      }
    })
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

    const texCoordLocation = this.gl.getAttribLocation(program, "a_texCoord")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Bind ping FBO texture (or pong if ping is empty)
    const pingFBO = this.fboManager.getFBO("ping")
    const pongFBO = this.fboManager.getFBO("pong")

    // Use whichever FBO has data, preferring ping
    let finalFBO = pingFBO
    if (!pingFBO || this.isFBOEmpty(pingFBO)) {
      finalFBO = pongFBO
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
    // If no FBO has content, the canvas will remain transparent (already cleared above)
  }

  // Helper method to get the rendering order for debugging
  private getRenderingOrder(layers: Layer[]): Layer[] {
    return layers
      .filter((layer) => {
        if (!layer.visible) return false
        if (layer.id === "layer-1") {
          return !!layer.image || !layer.isEmpty
        }
        return !!layer.image || !layer.isEmpty
      })
      .sort((a, b) => {
        // Reverse the order for rendering: bottom layers first, top layers last
        return layers.indexOf(b) - layers.indexOf(a)
      })
  }

  // Method to render all layers with proper compositing using ping-pong FBOs
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
    if (!this.gl || !this.layerProgram || !this.compositingProgram) {
      console.error("Missing GL context or shader programs")
      return
    }

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
      const layer = visibleLayers[i]
      const layerTexture = layerTextures.get(layer.id)

      if (!layerTexture) {
        continue
      }

      // Get the tools values for this layer
      const layerToolsValues =
        layer.id === selectedLayerId ? toolsValues : layer.filters

      // Render this layer with its filters
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
        // Store the first layer in the ping FBO as the base
        this.copyTextureToFBO(renderedLayerTexture, "ping")
        accumulatedTexture =
          this.fboManager.getFBO("ping")?.texture || renderedLayerTexture
        usePing = true
      } else {
        // Composite this layer with the accumulated result using the layer's blend mode
        // The accumulated result contains all visible layers below this one

        // Determine which FBO to use for output
        const outputFBO = usePing ? "ping" : "pong"
        const inputFBO = usePing ? "pong" : "ping"

        // Handle the accumulated texture - avoid copying FBO textures
        const inputFBOObj = this.fboManager.getFBO(inputFBO)
        const outputFBOObj = this.fboManager.getFBO(outputFBO)

        if (this.fboManager.isTextureBoundToFBO(accumulatedTexture)) {
          // The accumulated texture is an FBO texture, but not in the input FBO
          // We need to copy it, but be careful about feedback loops
          const sourceFBO = this.fboManager.getFBOByTexture(accumulatedTexture)
          if (sourceFBO && sourceFBO !== inputFBO) {
            this.copyTextureToFBO(accumulatedTexture, inputFBO)
          }
        } else {
          // It's a regular texture, safe to copy
          this.copyTextureToFBO(accumulatedTexture, inputFBO)
        }

        // Additional feedback loop check - ensure we're not trying to composite with the same texture
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

        // Composite the current layer with the accumulated result
        // This applies the current layer's blend mode to all visible layers below it
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
          usePing = !usePing // Switch ping-pong for next iteration
        }
      }
    }

    // Store the final result in the ping FBO (or whichever one we ended up using)
    if (accumulatedTexture) {
      const finalFBO = usePing ? "ping" : "pong"
      const finalFBOObj = this.fboManager.getFBO(finalFBO)

      // Only copy if the accumulated texture is not already the final FBO texture
      if (accumulatedTexture !== finalFBOObj?.texture) {
        // Check if we're trying to copy an FBO texture
        if (this.fboManager.isTextureBoundToFBO(accumulatedTexture)) {
          const sourceFBO = this.fboManager.getFBOByTexture(accumulatedTexture)
          if (sourceFBO && sourceFBO !== finalFBO) {
            this.copyTextureToFBO(accumulatedTexture, finalFBO)
          }
        } else {
          // Regular texture, safe to copy
          this.copyTextureToFBO(accumulatedTexture, finalFBO)
        }
      }
    }
  }

  cleanup(): void {
    if (!this.gl) return

    // Clean up programs
    if (this.layerProgram) {
      this.gl.deleteProgram(this.layerProgram)
      this.layerProgram = null
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
    if (this.texCoordBuffer) {
      this.gl.deleteBuffer(this.texCoordBuffer)
      this.texCoordBuffer = null
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
