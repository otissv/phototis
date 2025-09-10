/**
 * Centralized rendering configuration for consistent UNPACK_FLIP_Y_WEBGL
 * and texture coordinate handling across all renderers.
 */

/**
 * Centralized rendering policy for texture orientation and coordinates.
 *
 * Policy: Use UNPACK_FLIP_Y_WEBGL=false and normal texcoords
 * - Layer textures (uploaded images): Use normal V texcoords
 * - FBO textures (compositing/adjustments): Use normal V texcoords
 */
export namespace RenderConfig {
  /** Global UNPACK_FLIP_Y_WEBGL setting - always false */
  export const UNPACK_FLIP_Y_WEBGL = false

  /** Texture coordinates for layer sampling (uploaded images) - normal V */
  export const LAYER_TEXCOORDS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

  /** Texture coordinates for FBO sampling (compositing/adjustments) - normal V */
  export const COMP_TEXCOORDS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

  /** Texture coordinates for canvas/display - normal V */
  export const CANVAS_TEXCOORDS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

  /**
   * Configure WebGL context with our standard UNPACK_FLIP_Y_WEBGL setting
   */
  export function configureWebGL(gl: WebGL2RenderingContext): void {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, UNPACK_FLIP_Y_WEBGL)
  }

  /**
   * Create and configure a layer texcoord buffer
   */
  export function createLayerTexCoordBuffer(
    gl: WebGL2RenderingContext
  ): WebGLBuffer {
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error("Failed to create layer texcoord buffer")

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, LAYER_TEXCOORDS, gl.STATIC_DRAW)
    return buffer
  }

  /**
   * Create and configure a compositing texcoord buffer
   */
  export function createCompTexCoordBuffer(
    gl: WebGL2RenderingContext
  ): WebGLBuffer {
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error("Failed to create comp texcoord buffer")

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, COMP_TEXCOORDS, gl.STATIC_DRAW)
    return buffer
  }

  /**
   * Create and configure a canvas texcoord buffer
   */
  export function createCanvasTexCoordBuffer(
    gl: WebGL2RenderingContext
  ): WebGLBuffer {
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error("Failed to create canvas texcoord buffer")

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, CANVAS_TEXCOORDS, gl.STATIC_DRAW)
    return buffer
  }

  /**
   * Get debug info about current configuration
   */
  export function getDebugInfo(gl: WebGL2RenderingContext) {
    return {
      unpackFlipY: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),
      layerTexcoords: Array.from(LAYER_TEXCOORDS),
      compTexcoords: Array.from(COMP_TEXCOORDS),
      canvasTexcoords: Array.from(CANVAS_TEXCOORDS),
      policy: "UNPACK=false, all texcoords normal-V",
    }
  }
}
