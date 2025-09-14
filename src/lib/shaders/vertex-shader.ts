import { BaseShaderPlugin } from "./base-shader"

export class VertexShaderPlugin extends BaseShaderPlugin {
  name = "vertex"

  vertexShader = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    uniform float u_rotate;
    uniform float u_scale;
    uniform bool u_flipHorizontal;
    uniform bool u_flipVertical;
    uniform vec2 u_layerSize;
    uniform vec2 u_canvasSize;
    uniform vec2 u_layerPosition;
    
    void main() {
      // Start in layer-local space centered at (0,0), units = pixels
      // a_position is [0,1] across the quad; shift by 0.5 to center
      vec2 p = (a_position - vec2(0.5)) * u_layerSize;

      // Flips (about the center)
      if (u_flipHorizontal) p.x = -p.x;
      if (u_flipVertical) p.y = -p.y;

      // Scale then rotate around the center
      p *= u_scale;
      float angle = u_rotate * 3.14159 / 180.0;
      float cs = cos(angle);
      float sn = sin(angle);
      p = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);

      // Translate to the layer's center position in canvas pixels
      vec2 pixel = p + u_layerPosition;

      // Convert to NDC; Y axis in pixels is downward, so invert
      vec2 ndcPos = vec2(
        (pixel.x / u_canvasSize.x) * 2.0 - 1.0,
        1.0 - (pixel.y / u_canvasSize.y) * 2.0
      );

      gl_Position = vec4(ndcPos, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `

  fragmentShader = `
    precision highp float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_opacity;
    varying vec2 v_texCoord;

    void main() {
      vec2 uv = v_texCoord;
      vec4 color = texture2D(u_image, uv);
      
      // Apply opacity
      color.a *= u_opacity / 100.0;
      
      // Ensure proper alpha blending
      if (color.a < 0.01) {
        discard;
      }
      
      gl_FragColor = color;
    }
  `

  uniforms = {
    u_rotate: 0,
    u_scale: 1,
    u_flipHorizontal: 0,
    u_flipVertical: 0,
    u_layerSize: [0, 0] as [number, number],
    u_canvasSize: [0, 0] as [number, number],
    u_layerPosition: [0, 0] as [number, number],
    u_opacity: 100,
    u_brightness: 100,
    u_contrast: 100,
    u_saturation: 100,
    u_hue: 0,
    u_exposure: 0,
    u_temperature: 0,
    u_gamma: 1,
    u_vintage: 0,
    u_blur: 0,
    u_blurType: 0,
    u_blurDirection: 0,
    u_blurCenter: 0,
    u_invert: 0,
    u_sepia: 0,
    u_grayscale: 0,
    u_recolor: 0,
    u_recolorColor: [1, 0, 0] as [number, number, number],
    u_vibrance: 0,
    u_noise: 0,
    u_grain: 0,
    // solid fill uniforms defaults
    u_solidEnabled: 0,
    u_solidOpacity: 0,
    u_solidColor: [0, 0, 0] as [number, number, number],
    u_solidAlpha: 0,
    // packed in manager as vec3/float; here keep numbers for setUniforms
  }

  updateUniforms(values: any): void {
    if (values.rotate !== undefined) this.uniforms.u_rotate = values.rotate
    if (values.scale !== undefined) this.uniforms.u_scale = values.scale
    if (values.flipHorizontal !== undefined)
      this.uniforms.u_flipHorizontal = values.flipHorizontal
    if (values.flipVertical !== undefined)
      this.uniforms.u_flipVertical = values.flipVertical
    if (values.layerSize !== undefined)
      this.uniforms.u_layerSize = values.layerSize
    if (values.canvasSize !== undefined)
      this.uniforms.u_canvasSize = values.canvasSize
    if (values.layerPosition !== undefined)
      this.uniforms.u_layerPosition = values.layerPosition
    if (values.opacity !== undefined) this.uniforms.u_opacity = values.opacity
    if (values.brightness !== undefined)
      this.uniforms.u_brightness = values.brightness
    if (values.contrast !== undefined)
      this.uniforms.u_contrast = values.contrast
    if (values.saturation !== undefined)
      this.uniforms.u_saturation = values.saturation
    if (values.hue !== undefined) this.uniforms.u_hue = values.hue
    if (values.exposure !== undefined)
      this.uniforms.u_exposure = values.exposure
    if (values.temperature !== undefined)
      this.uniforms.u_temperature = values.temperature
    if (values.gamma !== undefined) this.uniforms.u_gamma = values.gamma
    if (values.vintage !== undefined) this.uniforms.u_vintage = values.vintage
    if (values.blur !== undefined) this.uniforms.u_blur = values.blur
    if (values.blurType !== undefined)
      this.uniforms.u_blurType = values.blurType
    if (values.blurDirection !== undefined)
      this.uniforms.u_blurDirection = values.blurDirection
    if (values.blurCenter !== undefined)
      this.uniforms.u_blurCenter = values.blurCenter
    if (values.invert !== undefined) this.uniforms.u_invert = values.invert
    if (values.sepia !== undefined) this.uniforms.u_sepia = values.sepia
    if (values.grayscale !== undefined)
      this.uniforms.u_grayscale = values.grayscale
    if (values.colorize !== undefined) this.uniforms.u_recolor = values.colorize
    if (values.u_recolorColor !== undefined)
      this.uniforms.u_recolorColor = values.u_recolorColor
    if (values.vibrance !== undefined)
      this.uniforms.u_vibrance = values.vibrance
    if (values.noise !== undefined) this.uniforms.u_noise = values.noise
    if (values.grain !== undefined) this.uniforms.u_grain = values.grain
    if (values.u_solidEnabled !== undefined)
      this.uniforms.u_solidEnabled = values.u_solidEnabled
    if (values.u_solidOpacity !== undefined)
      this.uniforms.u_solidOpacity = values.u_solidOpacity
    if (values.u_solidColor !== undefined)
      this.uniforms.u_solidColor = values.u_solidColor
    if (values.u_solidAlpha !== undefined)
      this.uniforms.u_solidAlpha = values.u_solidAlpha
  }
}
