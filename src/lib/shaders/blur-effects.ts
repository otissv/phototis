import { BaseShaderPlugin } from "./base-shader"

export class BlurEffectsPlugin extends BaseShaderPlugin {
  name = "blur-effects"

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
    uniform float u_blur;
    uniform float u_blurType;
    uniform float u_blurDirection;
    uniform float u_blurCenter;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    void main() {
      vec2 uv = v_texCoord;
      vec4 color = texture2D(u_image, uv);
      
      // Apply blur with different types
      if (u_blur > 0.0) {
        float blurAmount = u_blur / 100.0;
        vec2 blurSize = vec2(blurAmount * 0.2) / u_resolution;
        vec4 blurColor = vec4(0.0);
        float total = 0.0;
        
        if (u_blurType < 0.5) { // Gaussian Blur
          for (float x = -8.0; x <= 8.0; x++) {
            for (float y = -8.0; y <= 8.0; y++) {
              float weight = exp(-(x*x + y*y) / (8.0 * blurAmount * blurAmount));
              blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize) * weight;
              total += weight;
            }
          }
        } else if (u_blurType < 1.5) { // Box Blur
          for (float x = -6.0; x <= 6.0; x++) {
            for (float y = -6.0; y <= 6.0; y++) {
              blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize);
              total += 1.0;
            }
          }
        } else if (u_blurType < 2.5) { // Motion Blur
          float angle = u_blurDirection * 3.14159 / 180.0;
          vec2 direction = vec2(cos(angle), sin(angle));
          for (float i = -12.0; i <= 12.0; i++) {
            blurColor += texture2D(u_image, uv + direction * i * blurSize * 3.0);
            total += 1.0;
          }
        } else { // Radial Blur
          vec2 center = vec2(0.5 + u_blurCenter * 0.5, 0.5);
          vec2 dir = uv - center;
          float dist = length(dir);
          for (float i = -12.0; i <= 12.0; i++) {
            vec2 offset = dir * i * blurSize * 3.0;
            blurColor += texture2D(u_image, uv + offset);
            total += 1.0;
          }
        }
        
        color = mix(color, blurColor / total, blurAmount * 2.0);
      }
      
      gl_FragColor = color;
    }
  `

  uniforms = {}

  updateUniforms(values: any): void {
    // Blur effects are handled by the vertex shader plugin
  }
}
