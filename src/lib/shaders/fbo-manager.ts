export interface FBO {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
}

export interface LayerBounds {
  width: number
  height: number
  x: number
  y: number
  transformedWidth: number
  transformedHeight: number
  transformedX: number
  transformedY: number
}

export interface LayerFBO extends FBO {
  layerId: string
  bounds: LayerBounds
  transformMatrix: Float32Array // 4x4 transformation matrix
}

export class FBOManager {
  private gl: WebGL2RenderingContext | null = null
  private fbos: Map<string, FBO> = new Map()
  private layerFbos: Map<string, LayerFBO> = new Map()
  private currentFBO: FBO | null = null
  private fboPool: Map<string, FBO[]> = new Map() // FBO pooling for memory efficiency
  private preferFP16 = false
  private extColorBufferFloat: any | null = null
  private extTextureHalfFloat: any | null = null

  initialize(gl: WebGL2RenderingContext): void {
    this.gl = gl
    this.fbos.clear()
    this.layerFbos.clear()
    this.currentFBO = null
    this.fboPool.clear()
    // Detect FP16 renderability
    try {
      this.extColorBufferFloat = gl.getExtension("EXT_color_buffer_float")
      // WebGL2 supports HALF_FLOAT via EXT_color_buffer_float; RGBA16F internal format
      this.extTextureHalfFloat = this.extColorBufferFloat
      // Probe by creating a tiny FP16 FBO
      const testTex = gl.createTexture()
      const testFb = gl.createFramebuffer()
      if (testTex && testFb) {
        gl.bindTexture(gl.TEXTURE_2D, testTex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          (gl as any).RGBA16F || 0x881a,
          2,
          2,
          0,
          gl.RGBA,
          (gl as any).HALF_FLOAT || 0x140b,
          null
        )
        gl.bindFramebuffer(gl.FRAMEBUFFER, testFb)
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          testTex,
          0
        )
        const ok =
          gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
        this.preferFP16 = !!ok
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindTexture(gl.TEXTURE_2D, null)
      if (testTex) gl.deleteTexture(testTex)
      if (testFb) gl.deleteFramebuffer(testFb)
    } catch {
      this.preferFP16 = false
    }
  }

  // Expose whether FP16 internal textures are being used for FBOs
  isUsingFP16(): boolean {
    return this.preferFP16
  }

  // Calculate transformed bounds for a layer
  calculateLayerBounds(
    layerWidth: number,
    layerHeight: number,
    layerX: number,
    layerY: number,
    scale = 1.0,
    rotation = 0.0,
    flipHorizontal = 0,
    flipVertical = 0
  ): LayerBounds {
    // Apply scale
    const scaledWidth = layerWidth * scale
    const scaledHeight = layerHeight * scale

    // Apply rotation (simplified - for complex rotation we'd need proper matrix math)
    let rotatedWidth = scaledWidth
    let rotatedHeight = scaledHeight
    if (rotation !== 0) {
      const angle = (rotation * Math.PI) / 180
      const cos = Math.abs(Math.cos(angle))
      const sin = Math.abs(Math.sin(angle))
      rotatedWidth = scaledWidth * cos + scaledHeight * sin
      rotatedHeight = scaledWidth * sin + scaledHeight * cos
    }

    // Apply flips
    const finalWidth = rotatedWidth
    const finalHeight = rotatedHeight

    // Calculate transformed position (center-based transformation)
    const centerX = layerX + layerWidth / 2
    const centerY = layerY + layerHeight / 2
    const transformedCenterX = centerX
    const transformedCenterY = centerY
    const transformedX = transformedCenterX - finalWidth / 2
    const transformedY = transformedCenterY - finalHeight / 2

    return {
      width: layerWidth,
      height: layerHeight,
      x: layerX,
      y: layerY,
      transformedWidth: finalWidth,
      transformedHeight: finalHeight,
      transformedX,
      transformedY,
    }
  }

  // Create a 4x4 transformation matrix for a layer
  createTransformMatrix(
    scale = 1.0,
    rotation = 0.0,
    translationX = 0.0,
    translationY = 0.0,
    flipHorizontal = 0,
    flipVertical = 0
  ): Float32Array {
    const matrix = new Float32Array(16)

    // Identity matrix
    matrix[0] = 1
    matrix[1] = 0
    matrix[2] = 0
    matrix[3] = 0
    matrix[4] = 0
    matrix[5] = 1
    matrix[6] = 0
    matrix[7] = 0
    matrix[8] = 0
    matrix[9] = 0
    matrix[10] = 1
    matrix[11] = 0
    matrix[12] = 0
    matrix[13] = 0
    matrix[14] = 0
    matrix[15] = 1

    // Apply scale
    matrix[0] *= scale
    matrix[5] *= scale

    // Apply rotation
    if (rotation !== 0) {
      const angle = (rotation * Math.PI) / 180
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const temp0 = matrix[0]
      const temp1 = matrix[1]
      const temp4 = matrix[4]
      const temp5 = matrix[5]
      matrix[0] = temp0 * cos - temp4 * sin
      matrix[1] = temp1 * cos - temp5 * sin
      matrix[4] = temp0 * sin + temp4 * cos
      matrix[5] = temp1 * sin + temp5 * cos
    }

    // Apply flips
    if (flipHorizontal) {
      matrix[0] *= -1
    }
    if (flipVertical) {
      matrix[5] *= -1
    }

    // Apply translation
    matrix[12] = translationX
    matrix[13] = translationY

    return matrix
  }

  createFBO(width: number, height: number, name: string): FBO | null {
    if (!this.gl) return null

    // Check if we have a pooled FBO of the right size
    const poolKey = `${width}x${height}`
    const pooledFBOs = this.fboPool.get(poolKey)
    if (pooledFBOs && pooledFBOs.length > 0) {
      const fbo = pooledFBOs.pop()
      if (fbo) {
        this.fbos.set(name, fbo)
        return fbo
      }
    }

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
    if (this.preferFP16) {
      // Use RGBA16F/HALF_FLOAT when supported
      const RGBA16F = (this.gl as any).RGBA16F || 0x881a
      const HALF_FLOAT = (this.gl as any).HALF_FLOAT || 0x140b
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        RGBA16F,
        width,
        height,
        0,
        this.gl.RGBA,
        HALF_FLOAT,
        null
      )
    } else {
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
    }
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

  // Create a layer-specific FBO
  createLayerFBO(
    layerId: string,
    bounds: LayerBounds,
    transformMatrix: Float32Array
  ): LayerFBO | null {
    if (!this.gl) return null

    // Calculate FBO size based on transformed bounds
    const fboWidth = Math.ceil(bounds.transformedWidth)
    const fboHeight = Math.ceil(bounds.transformedHeight)

    // Ensure minimum size
    const minSize = 64
    const width = Math.max(fboWidth, minSize)
    const height = Math.max(fboHeight, minSize)

    const fbo = this.createFBO(width, height, `layer-${layerId}`)
    if (!fbo) return null

    const layerFBO: LayerFBO = {
      ...fbo,
      layerId,
      bounds,
      transformMatrix,
    }

    this.layerFbos.set(layerId, layerFBO)
    return layerFBO
  }

  // Get or create a layer FBO
  getOrCreateLayerFBO(
    layerId: string,
    bounds: LayerBounds,
    transformMatrix: Float32Array
  ): LayerFBO | null {
    const existingLayerFBO = this.layerFbos.get(layerId)

    // Check if we need to recreate the FBO due to size changes
    if (existingLayerFBO) {
      const currentWidth = Math.ceil(existingLayerFBO.bounds.transformedWidth)
      const currentHeight = Math.ceil(existingLayerFBO.bounds.transformedHeight)
      const newWidth = Math.ceil(bounds.transformedWidth)
      const newHeight = Math.ceil(bounds.transformedHeight)

      // If the transformed bounds have changed significantly, recreate the FBO
      if (
        Math.abs(currentWidth - newWidth) > 10 ||
        Math.abs(currentHeight - newHeight) > 10
      ) {
        this.deleteLayerFBO(layerId)
      } else {
        // Update bounds and transform matrix
        existingLayerFBO.bounds = bounds
        existingLayerFBO.transformMatrix = transformMatrix
        return existingLayerFBO
      }
    }

    // Create new layer FBO
    return this.createLayerFBO(layerId, bounds, transformMatrix)
  }

  // Delete a layer-specific FBO
  deleteLayerFBO(layerId: string): void {
    const layerFBO = this.layerFbos.get(layerId)
    if (layerFBO) {
      // Return to pool instead of deleting immediately
      const poolKey = `${layerFBO.width}x${layerFBO.height}`
      if (!this.fboPool.has(poolKey)) {
        this.fboPool.set(poolKey, [])
      }
      const pooledFBOs = this.fboPool.get(poolKey)
      if (pooledFBOs) {
        pooledFBOs.push(layerFBO)
      }

      this.layerFbos.delete(layerId)
      this.fbos.delete(`layer-${layerId}`)
    }
  }

  // Get a layer FBO
  getLayerFBO(layerId: string): LayerFBO | null {
    return this.layerFbos.get(layerId) || null
  }

  // Get all layer FBOs
  getLayerFBOs(): Map<string, LayerFBO> {
    return new Map(this.layerFbos)
  }

  bindFBO(name: string): boolean {
    const fbo = this.fbos.get(name)
    if (!fbo || !this.gl) return false

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo.framebuffer)
    this.gl.viewport(0, 0, fbo.width, fbo.height)
    this.currentFBO = fbo
    return true
  }

  // Bind a layer FBO
  bindLayerFBO(layerId: string): boolean {
    const layerFBO = this.layerFbos.get(layerId)
    if (!layerFBO || !this.gl) return false

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, layerFBO.framebuffer)
    this.gl.viewport(0, 0, layerFBO.width, layerFBO.height)
    this.currentFBO = layerFBO
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

  // Get the name of the FBO that a texture is bound to
  getFBOByTexture(texture: WebGLTexture): string | null {
    for (const [name, fbo] of this.fbos.entries()) {
      if (fbo.texture === texture) {
        return name
      }
    }
    return null
  }

  clearFBO(name: string, r = 0, g = 0, b = 0, a = 0): void {
    if (!this.gl) return

    const fbo = this.fbos.get(name)
    if (!fbo) return

    this.bindFBO(name)
    this.gl.clearColor(r, g, b, a)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  // Clear a layer FBO
  clearLayerFBO(layerId: string, r = 0, g = 0, b = 0, a = 0): void {
    if (!this.gl) return

    const layerFBO = this.layerFbos.get(layerId)
    if (!layerFBO) return

    this.bindLayerFBO(layerId)
    this.gl.clearColor(r, g, b, a)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  cleanup(): void {
    if (!this.gl) return

    // Clean up regular FBOs
    this.fbos.forEach((fbo) => {
      if (this.gl) {
        this.gl.deleteFramebuffer(fbo.framebuffer)
        this.gl.deleteTexture(fbo.texture)
      }
    })

    // Clean up layer FBOs
    this.layerFbos.forEach((layerFBO) => {
      if (this.gl) {
        this.gl.deleteFramebuffer(layerFBO.framebuffer)
        this.gl.deleteTexture(layerFBO.texture)
      }
    })

    // Clean up pooled FBOs
    this.fboPool.forEach((pooledFBOs) => {
      pooledFBOs.forEach((fbo) => {
        if (this.gl) {
          this.gl.deleteFramebuffer(fbo.framebuffer)
          this.gl.deleteTexture(fbo.texture)
        }
      })
    })

    this.fbos.clear()
    this.layerFbos.clear()
    this.fboPool.clear()
    this.currentFBO = null
    this.gl = null
  }
}
