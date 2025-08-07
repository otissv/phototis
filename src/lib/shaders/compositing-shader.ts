import { BLEND_MODE_GLSL } from "./blend-modes"

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
    vec4 baseColor = texture2D(u_baseTexture, v_texCoord);
    vec4 topColor = texture2D(u_topTexture, v_texCoord);
    
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
  uniform float u_tint;
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

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
  
  void main() {
    // Calculate layer positioning and cropping
    vec2 canvasCoord = v_texCoord * u_resolution;
    vec2 layerCoord = canvasCoord - vec2(u_layerX, u_layerY);
    
    // Check if the current pixel is within the layer bounds
    if (layerCoord.x < 0.0 || layerCoord.x >= u_layerWidth || 
        layerCoord.y < 0.0 || layerCoord.y >= u_layerHeight) {
      discard; // Outside layer bounds, make transparent
    }
    
    // Convert to texture coordinates for the layer
    vec2 uv = layerCoord / vec2(u_layerWidth, u_layerHeight);
    
    // Apply flip transformations
    if (u_flipHorizontal) {
      uv.x = 1.0 - uv.x;
    }
    if (u_flipVertical) {
      uv.y = 1.0 - uv.y;
    }
    
    // Apply rotation
    if (u_rotate != 0.0) {
      float angle = u_rotate * 3.14159 / 180.0;
      vec2 center = vec2(0.5);
      vec2 rotated = uv - center;
      vec2 rotatedCoord = vec2(
        rotated.x * cos(angle) - rotated.y * sin(angle),
        rotated.x * sin(angle) + rotated.y * cos(angle)
      );
      uv = rotatedCoord + center;
    }
    
    // Apply scale
    if (u_scale != 1.0) {
      vec2 center = vec2(0.5);
      uv = (uv - center) * u_scale + center;
    }
    
    // Clamp texture coordinates to prevent artifacts
    uv = clamp(uv, 0.0, 1.0);
    
    vec4 color = texture2D(u_image, uv);
    
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
    
    if (u_tint > 0.0) {
      color.rgb += vec3(u_tint / 100.0, 0.0, 0.0);
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
