import { BaseShaderPlugin } from "./base-shader"

export class ColorAdjustmentsPlugin extends BaseShaderPlugin {
  name = "color-adjustments"

  vertexShader = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    
    void main() {
      gl_Position = vec4(a_position, 0, 1);
      v_texCoord = a_texCoord;
    }
  `

  fragmentShader = `
    precision highp float;
    uniform sampler2D u_image;
    uniform float u_brightness;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_hue;
    uniform float u_exposure;
    uniform float u_temperature;
    uniform float u_gamma;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    // Helper functions
    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      vec2 uv = v_texCoord;
      vec4 color = texture2D(u_image, uv);
      
      // Apply brightness (normalized to 0-2 range)
      color.rgb *= (u_brightness / 100.0);
      
      // Apply contrast (normalized to 0-2 range)
      color.rgb = ((color.rgb - 0.5) * (u_contrast / 100.0)) + 0.5;
      
      // Convert to HSV for hue and saturation adjustments
      vec3 hsv = rgb2hsv(color.rgb);
      
      // Apply hue rotation (normalized to 0-1 range)
      hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
      
      // Apply saturation (normalized to 0-2 range)
      hsv.y *= (u_saturation / 100.0);
      
      // Convert back to RGB
      color.rgb = hsv2rgb(hsv);
      
      // Apply exposure (normalized to -1 to 1 range)
      color.rgb *= pow(2.0, u_exposure / 100.0);
      
      // Apply temperature (normalized to -1 to 1 range)
      color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
      
      // Apply gamma (normalized to 0.1-3.0 range)
      color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
      
      gl_FragColor = color;
    }
  `

  uniforms = {}

  updateUniforms(values: any): void {
    // Color adjustments are handled by the vertex shader plugin
  }
}
