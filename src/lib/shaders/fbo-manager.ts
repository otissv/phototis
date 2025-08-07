export interface FBO {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
}

export class FBOManager {
  private gl: WebGL2RenderingContext | null = null
  private fbos: Map<string, FBO> = new Map()
  private currentFBO: FBO | null = null

  initialize(gl: WebGL2RenderingContext): void {
    this.gl = gl
    this.fbos.clear()
    this.currentFBO = null
  }

  createFBO(width: number, height: number, name: string): FBO | null {
    if (!this.gl) return null

    // Create framebuffer
    const framebuffer = this.gl.createFramebuffer()
    if (!framebuffer) {
      console.error("Failed to create framebuffer")
      return null
    }

    // Create texture
    const texture = this.gl.createTexture()
    if (!texture) {
      console.error("Failed to create texture")
      this.gl.deleteFramebuffer(framebuffer)
      return null
    }

    // Bind texture and set parameters
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
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

    // Bind framebuffer and attach texture
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    )

    // Check framebuffer status
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER)
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      console.error("Framebuffer not complete:", status)
      this.gl.deleteFramebuffer(framebuffer)
      this.gl.deleteTexture(texture)
      return null
    }

    const fbo: FBO = {
      framebuffer,
      texture,
      width,
      height,
    }

    this.fbos.set(name, fbo)
    return fbo
  }

  bindFBO(name: string): boolean {
    const fbo = this.fbos.get(name)
    if (!fbo || !this.gl) return false

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo.framebuffer)
    this.gl.viewport(0, 0, fbo.width, fbo.height)
    this.currentFBO = fbo
    return true
  }

  bindDefaultFramebuffer(): void {
    if (!this.gl) return
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.currentFBO = null
  }

  getFBO(name: string): FBO | null {
    return this.fbos.get(name) || null
  }

  getCurrentFBO(): FBO | null {
    return this.currentFBO
  }

  // Check if a texture is bound to any FBO
  isTextureBoundToFBO(texture: WebGLTexture): boolean {
    for (const fbo of this.fbos.values()) {
      if (fbo.texture === texture) {
        return true
      }
    }
    return false
  }

  clearFBO(name: string, r = 0, g = 0, b = 0, a = 0): void {
    if (!this.gl) return

    const fbo = this.fbos.get(name)
    if (!fbo) return

    this.bindFBO(name)
    this.gl.clearColor(r, g, b, a)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  cleanup(): void {
    if (!this.gl) return

    this.fbos.forEach((fbo) => {
      if (this.gl) {
        this.gl.deleteFramebuffer(fbo.framebuffer)
        this.gl.deleteTexture(fbo.texture)
      }
    })

    this.fbos.clear()
    this.currentFBO = null
    this.gl = null
  }
}
