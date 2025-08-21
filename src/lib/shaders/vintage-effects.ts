import { BaseShaderPlugin } from "./base-shader"

export class VintageEffectsPlugin extends BaseShaderPlugin {
  name = "vintage-effects"

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
    uniform float u_vintage;
    uniform float u_invert;
    uniform float u_sepia;
    uniform float u_grayscale;
    uniform float u_recolor;
    uniform float u_vibrance;
    uniform float u_noise;
    uniform float u_grain;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    // Noise function
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = v_texCoord;
      vec4 color = texture2D(u_image, uv);
      
      // Apply vintage effect (vignette)
      float vignette = 1.0 - length(uv - 0.5) * (u_vintage / 100.0);
      color.rgb *= vignette;
      
      // Apply invert (normalized to 0-1 range)
      if (u_invert > 0.0) {
        color.rgb = mix(color.rgb, 1.0 - color.rgb, u_invert / 100.0);
      }
      
      // Apply sepia (normalized to 0-1 range)
      if (u_sepia > 0.0) {
        vec3 sepia = vec3(
          dot(color.rgb, vec3(0.393, 0.769, 0.189)),
          dot(color.rgb, vec3(0.349, 0.686, 0.168)),
          dot(color.rgb, vec3(0.272, 0.534, 0.131))
        );
        color.rgb = mix(color.rgb, sepia, u_sepia / 100.0);
      }
      
      // Apply grayscale (normalized to 0-1 range)
      if (u_grayscale > 0.0) {
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(color.rgb, vec3(gray), u_grayscale / 100.0);
      }
      
      // Apply recolor (normalized to -1 to 1 range)
      if (u_recolor > 0.0) {
        color.rgb += vec3(u_recolor / 100.0, 0.0, 0.0);
      }
      
      // Apply vibrance (normalized to -1 to 1 range)
      if (u_vibrance > 0.0) {
        float maxChannel = max(max(color.r, color.g), color.b);
        float minChannel = min(min(color.r, color.g), color.b);
        float saturation = (maxChannel - minChannel) / maxChannel;
        color.rgb = mix(color.rgb, color.rgb * (1.0 + u_vibrance / 100.0), saturation);
      }
      
      // Apply noise (normalized to 0-0.5 range)
      if (u_noise > 0.0) {
        float noise = random(uv) * (u_noise / 100.0);
        color.rgb += noise;
      }
      
      // Apply grain (normalized to 0-0.5 range)
      if (u_grain > 0.0) {
        float grain = random(uv * 100.0) * (u_grain / 100.0);
        color.rgb += grain;
      }
      
      gl_FragColor = color;
    }
  `

  uniforms = {}

  updateUniforms(values: any): void {
    // Vintage effects are handled by the vertex shader plugin
  }
}
