import { BLEND_MODE_GLSL } from "./blend-modes/blend-modes"

export const COMPOSITING_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

export const COMPOSITING_FRAGMENT_SHADER = `
  precision highp float;
  
  uniform sampler2D u_baseTexture;
  uniform sampler2D u_topTexture;
  uniform int u_blendMode;
  uniform float u_opacity;
  uniform vec2 u_resolution;
  
  varying vec2 v_texCoord;
  
  ${BLEND_MODE_GLSL}
  
  void main() {
    vec2 uv = v_texCoord;
    vec4 baseColor = texture2D(u_baseTexture, uv);
    vec4 topColor = texture2D(u_topTexture, uv);
    
    // Apply opacity to top layer
    topColor.a *= u_opacity / 100.0;
    
    // If top layer is completely transparent, just show base
    if (topColor.a < 0.01) {
      gl_FragColor = baseColor;
      return;
    }
    
    // If base is completely transparent, just show top
    if (baseColor.a < 0.01) {
      gl_FragColor = topColor;
      return;
    }
    
    // Apply blend mode with proper alpha handling
    vec4 blendedColor = applyBlendMode(baseColor, topColor, u_blendMode);
    
    // Ensure alpha is properly handled
    if (blendedColor.a < 0.01) {
      discard;
    }
    
    gl_FragColor = blendedColor;
  }
`

export const LAYER_RENDER_FRAGMENT_SHADER = `
  precision highp float;
  
  uniform sampler2D u_image;
  uniform vec2 u_resolution;
  uniform float u_opacity;
  // Solid fill uniforms (optional)
  uniform int u_solidEnabled;
  // No per-effect opacity for solid; global opacity is used via compositing
  uniform vec3 u_solidColor;
  uniform float u_solidAlpha;
  // Recolor color support
  uniform vec3 u_recolorColor;
  // Recolor (Affinity-style) uniforms
  uniform float u_recolorHue;         // degrees [-180..180] or [0..360]
  uniform float u_recolorSaturation;  // [0..100]
  uniform float u_recolorLightness;   // [0..100]
  uniform int u_recolorPreserveLum;   // 0/1
  uniform float u_recolorAmount;      // [0..100]
  
  // Layer positioning and cropping
  uniform float u_layerWidth;
  uniform float u_layerHeight;
  uniform float u_layerX;
  uniform float u_layerY;
  
  // Color adjustments
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_hue;
  uniform float u_exposure;
  uniform float u_temperature;
  uniform float u_gamma;
  
  // Blur effects
  uniform float u_blur;
  uniform float u_blurType;
  uniform float u_blurDirection;
  uniform float u_blurCenter;
  
  // Artistic effects
  uniform float u_vintage;
  uniform float u_invert;
  uniform float u_sepia;
  uniform float u_grayscale;
  uniform float u_recolor;
  uniform float u_vibrance;
  uniform float u_noise;
  uniform float u_grain;
  
  // Transformations
  uniform float u_rotate;
  uniform float u_scale;
  uniform bool u_flipHorizontal;
  uniform bool u_flipVertical;
  
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

  // HSL helpers for recolor
  vec3 rgb2hsl(vec3 c) {
    float r = c.r, g = c.g, b = c.b;
    float maxc = max(max(r, g), b);
    float minc = min(min(r, g), b);
    float l = (maxc + minc) * 0.5;
    float h = 0.0;
    float s = 0.0;
    if (maxc != minc) {
      float d = maxc - minc;
      s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
      if (maxc == r) {
        h = (g - b) / d + (g < b ? 6.0 : 0.0);
      } else if (maxc == g) {
        h = (b - r) / d + 2.0;
      } else {
        h = (r - g) / d + 4.0;
      }
      h /= 6.0;
    }
    return vec3(h, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    float r, g, b;
    if (s == 0.0) {
      r = g = b = l; // achromatic
    } else {
      float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
      float p = 2.0 * l - q;
      r = hue2rgb(p, q, h + 1.0/3.0);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1.0/3.0);
    }
    return vec3(r, g, b);
  }

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
  
  void main() {
    // Canvas pixel in canvas space
    vec2 canvasCoord = v_texCoord * u_resolution;

    // Map to layer-local space (origin at layer top-left)
    vec2 layerCoord = canvasCoord - vec2(u_layerX, u_layerY);

    // Early discard if layer is completely outside canvas bounds
    if (layerCoord.x < -u_layerWidth || layerCoord.x > u_resolution.x ||
        layerCoord.y < -u_layerHeight || layerCoord.y > u_resolution.y) {
      discard;
    }

    // Normalize to [0,1] in layer space before transforms
    vec2 uv = layerCoord / vec2(u_layerWidth, u_layerHeight);

    // Move to centered coords for inverse transform
    vec2 c = uv - vec2(0.5);

    // Inverse scale
    if (u_scale != 1.0 && u_scale != 0.0) {
      c /= u_scale;
    }

    // Inverse rotation in pixel space to preserve aspect ratio
    if (u_rotate != 0.0) {
      float angle = -u_rotate * 3.14159 / 180.0; // inverse
      float cs = cos(angle);
      float sn = sin(angle);
      // convert to pixel space so X and Y have same units
      vec2 dims = vec2(u_layerWidth, u_layerHeight);
      vec2 cpx = c * dims;
      cpx = vec2(cpx.x * cs - cpx.y * sn, cpx.x * sn + cpx.y * cs);
      // back to normalized space
      c = cpx / dims;
    }

    // Inverse flips
    if (u_flipHorizontal) {
      c.x = -c.x;
    }
    if (u_flipVertical) {
      c.y = -c.y;
    }

    // Back to UV space
    uv = c + vec2(0.5);

    // Clip to image bounds after applying transforms
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      discard;
    }

    vec4 color = texture2D(u_image, uv);
    // Solid adjustment mixes a solid over current sampled color
    if (u_solidEnabled == 1) {
      // Render solid over the current color; per-layer opacity/blend is applied later
      vec4 solidColor = vec4(u_solidColor, u_solidAlpha);
      color = solidColor;
    }
    
    // Apply color adjustments
    color.rgb *= (u_brightness / 100.0);
    color.rgb = ((color.rgb - 0.5) * (u_contrast / 100.0)) + 0.5;
    
    vec3 hsv = rgb2hsv(color.rgb);
    hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
    hsv.y *= (u_saturation / 100.0);
    color.rgb = hsv2rgb(hsv);
    
    color.rgb *= pow(2.0, u_exposure / 100.0);
    color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
    color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
    
    // Apply vintage effect
    float vignette = 1.0 - length(uv - 0.5) * (u_vintage / 100.0);
    color.rgb *= vignette;
    
    // Apply blur effects
    if (u_blur > 0.0) {
      float blurAmount = u_blur / 100.0;
      vec2 blurSize = vec2(blurAmount * 0.2) / vec2(u_layerWidth, u_layerHeight);
      vec4 blurColor = vec4(0.0);
      float total = 0.0;
      
      if (u_blurType < 0.5) {
        for (float x = -8.0; x <= 8.0; x++) {
          for (float y = -8.0; y <= 8.0; y++) {
            float weight = exp(-(x*x + y*y) / (8.0 * blurAmount * blurAmount));
            vec2 sampleUV = uv + vec2(x, y) * blurSize;
            sampleUV = clamp(sampleUV, 0.0, 1.0);
            blurColor += texture2D(u_image, sampleUV) * weight;
            total += weight;
          }
        }
      } else if (u_blurType < 1.5) {
        for (float x = -6.0; x <= 6.0; x++) {
          for (float y = -6.0; y <= 6.0; y++) {
            vec2 sampleUV = uv + vec2(x, y) * blurSize;
            sampleUV = clamp(sampleUV, 0.0, 1.0);
            blurColor += texture2D(u_image, sampleUV);
            total += 1.0;
          }
        }
      } else if (u_blurType < 2.5) {
        float angle = u_blurDirection * 3.14159 / 180.0;
        vec2 direction = vec2(cos(angle), sin(angle));
        for (float i = -12.0; i <= 12.0; i++) {
          vec2 sampleUV = uv + direction * i * blurSize * 3.0;
          sampleUV = clamp(sampleUV, 0.0, 1.0);
          blurColor += texture2D(u_image, sampleUV);
          total += 1.0;
        }
      } else {
        vec2 center = vec2(0.5 + u_blurCenter * 0.5, 0.5);
        vec2 dir = uv - center;
        for (float i = -12.0; i <= 12.0; i++) {
          vec2 offset = dir * i * blurSize * 3.0;
          vec2 sampleUV = uv + offset;
          sampleUV = clamp(sampleUV, 0.0, 1.0);
          blurColor += texture2D(u_image, sampleUV);
          total += 1.0;
        }
      }
      
      color = mix(color, blurColor / total, blurAmount * 2.0);
    }
    
    // Apply artistic effects
    if (u_invert > 0.0) {
      color.rgb = mix(color.rgb, 1.0 - color.rgb, u_invert / 100.0);
    }
    
    if (u_sepia > 0.0) {
      vec3 sepia = vec3(
        dot(color.rgb, vec3(0.393, 0.769, 0.189)),
        dot(color.rgb, vec3(0.349, 0.686, 0.168)),
        dot(color.rgb, vec3(0.272, 0.534, 0.131))
      );
      color.rgb = mix(color.rgb, sepia, u_sepia / 100.0);
    }
    
    if (u_grayscale > 0.0) {
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(color.rgb, vec3(gray), u_grayscale / 100.0);
    }
    
    // Affinity-style Recolor: set H/S/(L or preserve) and mix by Amount
    if (u_recolorAmount > 0.0) {
      vec3 src = color.rgb;
      vec3 hsl = rgb2hsl(src);
      float h = mod((u_recolorHue / 360.0) + 1.0, 1.0);
      float s = clamp(u_recolorSaturation / 100.0, 0.0, 1.0);
      float l = (u_recolorPreserveLum == 1)
        ? hsl.z
        : clamp(u_recolorLightness / 100.0, -1.0, 2.0);
      // When not preserving luminance, map lightness directly to grayscale (#000000..#ffffff)
      vec3 recolored = hsl2rgb(vec3(h, s, l));
      float amt = clamp(u_recolorAmount / 100.0, 0.0, 1.0);
      color.rgb = mix(src, recolored, amt);
    }
    
    if (u_vibrance > 0.0) {
      float maxChannel = max(max(color.r, color.g), color.b);
      float minChannel = min(min(color.r, color.g), color.b);
      float saturation = (maxChannel - minChannel) / maxChannel;
      color.rgb = mix(color.rgb, color.rgb * (1.0 + u_vibrance / 100.0), saturation);
    }
    
    if (u_noise > 0.0) {
      float noise = random(uv) * (u_noise / 100.0);
      color.rgb += noise;
    }
    
    if (u_grain > 0.0) {
      float grain = random(uv * 100.0) * (u_grain / 100.0);
      color.rgb += grain;
    }
    
    // Apply opacity
    color.a *= u_opacity / 100.0;
    
    if (color.a < 0.01) {
      discard;
    }
    
    gl_FragColor = color;
  }
`
