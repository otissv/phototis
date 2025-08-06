import { FBOManager, type FBO } from "./fbo-manager"
import { BLEND_MODE_MAP, type BlendMode } from "./blend-modes"
import { COMPOSITING_VERTEX_SHADER, COMPOSITING_FRAGMENT_SHADER, LAYER_RENDER_FRAGMENT_SHADER } from "./compositing-shader"
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

    // Create FBOs for compositing
    const tempFBO = this.fboManager.createFBO(width, height, "temp")
    const resultFBO = this.fboManager.createFBO(width, height, "result")
    
    if (!tempFBO || !resultFBO) {
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

  private compileProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
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
    canvasHeight: number
  ): WebGLTexture | null {
    if (!this.gl || !this.layerProgram) return null

    // Bind temp FBO for layer rendering
    this.fboManager.bindFBO("temp")
    this.fboManager.clearFBO("temp", 0, 0, 0, 0)

    // Use layer program
    this.gl.useProgram(this.layerProgram)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(this.layerProgram, "a_position")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    const texCoordLocation = this.gl.getAttribLocation(this.layerProgram, "a_texCoord")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Set uniforms
    this.setLayerUniforms(toolsValues, layer.opacity, canvasWidth, canvasHeight)

    // Bind layer texture
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, layerTexture)
    const samplerLocation = this.gl.getUniformLocation(this.layerProgram, "u_image")
    if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the rendered texture
    return this.fboManager.getFBO("temp")?.texture || null
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
    const positionLocation = this.gl.getAttribLocation(this.compositingProgram, "a_position")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    const texCoordLocation = this.gl.getAttribLocation(this.compositingProgram, "a_texCoord")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Set uniforms
    const blendModeLocation = this.gl.getUniformLocation(this.compositingProgram, "u_blendMode")
    if (blendModeLocation) {
      this.gl.uniform1i(blendModeLocation, BLEND_MODE_MAP[blendMode])
    }

    const opacityLocation = this.gl.getUniformLocation(this.compositingProgram, "u_opacity")
    if (opacityLocation) {
      this.gl.uniform1f(opacityLocation, opacity)
    }

    const resolutionLocation = this.gl.getUniformLocation(this.compositingProgram, "u_resolution")
    if (resolutionLocation) {
      this.gl.uniform2f(resolutionLocation, canvasWidth, canvasHeight)
    }

    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, baseTexture)
    const baseSamplerLocation = this.gl.getUniformLocation(this.compositingProgram, "u_baseTexture")
    if (baseSamplerLocation) this.gl.uniform1i(baseSamplerLocation, 0)

    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, topTexture)
    const topSamplerLocation = this.gl.getUniformLocation(this.compositingProgram, "u_topTexture")
    if (topSamplerLocation) this.gl.uniform1i(topSamplerLocation, 1)

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Return the composited texture
    return this.fboManager.getFBO("result")?.texture || null
  }

  private setLayerUniforms(
    toolsValues: ImageEditorToolsState,
    opacity: number,
    canvasWidth: number,
    canvasHeight: number
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

    // Bind default framebuffer
    this.fboManager.bindDefaultFramebuffer()
    this.gl.viewport(0, 0, canvas.width, canvas.height)

    // Clear canvas
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    // Use compositing program to render final result
    if (!this.compositingProgram) return
    this.gl.useProgram(this.compositingProgram)

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(this.compositingProgram, "a_position")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    const texCoordLocation = this.gl.getAttribLocation(this.compositingProgram, "a_texCoord")
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
    this.gl.enableVertexAttribArray(texCoordLocation)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Bind result texture
    const resultFBO = this.fboManager.getFBO("result")
    if (resultFBO) {
      this.gl.activeTexture(this.gl.TEXTURE0)
      this.gl.bindTexture(this.gl.TEXTURE_2D, resultFBO.texture)
      const samplerLocation = this.gl.getUniformLocation(this.compositingProgram, "u_baseTexture")
      if (samplerLocation) this.gl.uniform1i(samplerLocation, 0)

      // Create a transparent texture for the "top" layer (we're just displaying the result)
      this.gl.activeTexture(this.gl.TEXTURE1)
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.compositingTexture)
      const topSamplerLocation = this.gl.getUniformLocation(this.compositingProgram, "u_topTexture")
      if (topSamplerLocation) this.gl.uniform1i(topSamplerLocation, 1)

      // Set blend mode to normal
      const blendModeLocation = this.gl.getUniformLocation(this.compositingProgram, "u_blendMode")
      if (blendModeLocation) {
        this.gl.uniform1i(blendModeLocation, 0) // Normal blend mode
      }

      // Set opacity to 100%
      const opacityLocation = this.gl.getUniformLocation(this.compositingProgram, "u_opacity")
      if (opacityLocation) {
        this.gl.uniform1f(opacityLocation, 100)
      }

      // Set resolution
      const resolutionLocation = this.gl.getUniformLocation(this.compositingProgram, "u_resolution")
      if (resolutionLocation) {
        this.gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      }

      // Draw
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
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