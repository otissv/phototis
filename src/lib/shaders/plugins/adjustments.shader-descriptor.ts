import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const AdjustmentsBasicDescriptor: ShaderDescriptor = {
  name: "adjustments.basic",
  version: "1.0.0",
  sources: {
    vertex: `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }
`,
    fragment: `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_opacity;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;
uniform float u_exposure;
uniform float u_gamma;
uniform float u_grayscale;
uniform float u_temperature;
uniform float u_invert;
uniform float u_sepia;
uniform float u_vibrance;
uniform float u_tint;
uniform float u_colorizeHue;
uniform float u_colorizeSaturation;
uniform float u_colorizeLightness;
uniform int u_colorizePreserveLum;
uniform float u_colorizeAmount;
uniform float u_sharpenAmount;
uniform float u_sharpenRadius;
uniform float u_sharpenThreshold;
uniform float u_noiseAmount;
uniform float u_noiseSize;
uniform float u_gaussianAmount;
uniform float u_gaussianRadius;
uniform int u_solidEnabled;
uniform vec3 u_solidColor;
uniform float u_solidAlpha;
in vec2 v_texCoord;
out vec4 outColor;

vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0., -1./3., 2./3., -1.);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6. * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1., 2./3., 1./3., 3.);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
}

// HSL helpers for Colorize
float hue2rgb(float p, float q, float t){
  if(t < 0.0) t += 1.0;
  if(t > 1.0) t -= 1.0;
  if(t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if(t < 1.0/2.0) return q;
  if(t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 rgb2hsl(vec3 c){
  float r = c.r, g = c.g, b = c.b;
  float maxc = max(max(r, g), b);
  float minc = min(min(r, g), b);
  float h = 0.0;
  float s = 0.0;
  float l = (maxc + minc) * 0.5;
  if (maxc != minc) {
    float d = maxc - minc;
    s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
    if (maxc == r) h = (g - b) / d + (g < b ? 6.0 : 0.0);
    else if (maxc == g) h = (b - r) / d + 2.0;
    else h = (r - g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 hsl){
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s == 0.0) return vec3(l, l, l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  float r = hue2rgb(p, q, h + 1.0/3.0);
  float g = hue2rgb(p, q, h);
  float b = hue2rgb(p, q, h - 1.0/3.0);
  return vec3(r, g, b);
}

// Noise function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main(){
  vec2 uv = v_texCoord;
  vec4 color = texture(u_texture, uv);
  // Solid overlay (for solid adjustment layer)
  if (u_solidEnabled == 1) {
    color = vec4(u_solidColor, clamp(u_solidAlpha, 0.0, 1.0));
    // Debug: force a visible color to test if solid is working
    // color = vec4(1.0, 0.0, 0.0, 1.0); // Uncomment to test
  }
  // Brightness: additive in [-1..1]
  float b = clamp((u_brightness - 100.0) / 100.0, -1.0, 1.0);
  color.rgb = clamp(color.rgb + vec3(b), 0.0, 1.0);
  // Contrast: scale around 0.5; slider [0..200] => factor [0..2]
  float c = clamp((u_contrast - 100.0) / 100.0, -1.0, 1.0);
  color.rgb = clamp(((color.rgb - 0.5) * (1.0 + c)) + 0.5, 0.0, 1.0);
  vec3 hsv = rgb2hsv(color.rgb);
  hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
  hsv.y *= (u_saturation / 100.0);
  color.rgb = hsv2rgb(hsv);
  // Exposure: stops (2^s)
  color.rgb = clamp(color.rgb * pow(2.0, u_exposure / 100.0), 0.0, 1.0);
  color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
  // Gamma: typical decoding curve
  color.rgb = pow(color.rgb, vec3(1.0 / max(0.0001, u_gamma)));
  // Grayscale adjustment (mix towards luminance)
  if (u_grayscale > 0.0) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), clamp(u_grayscale / 100.0, 0.0, 1.0));
  }
  // Invert
  if (u_invert > 0.0) {
    color.rgb = mix(color.rgb, 1.0 - color.rgb, clamp(u_invert / 100.0, 0.0, 1.0));
  }
  // Sepia
  if (u_sepia > 0.0) {
    vec3 sep = vec3(
      dot(color.rgb, vec3(0.393, 0.769, 0.189)),
      dot(color.rgb, vec3(0.349, 0.686, 0.168)),
      dot(color.rgb, vec3(0.272, 0.534, 0.131))
    );
    color.rgb = mix(color.rgb, sep, clamp(u_sepia / 100.0, 0.0, 1.0));
  }
  // Vibrance: increase saturation more for low-sat colors
  if (u_vibrance != 0.0) {
    vec3 hsv_v = rgb2hsv(color.rgb);
    float vib = clamp(u_vibrance / 100.0, -1.0, 1.0);
    if (vib >= 0.0) {
      hsv_v.y += (1.0 - hsv_v.y) * vib;
    } else {
      hsv_v.y += hsv_v.y * vib; // reduce saturation
    }
    hsv_v.y = clamp(hsv_v.y, 0.0, 1.0);
    color.rgb = hsv2rgb(hsv_v);
  }
  // Colorize (HSL): set H/S/(L or preserve) and mix by Amount
  if (u_colorizeAmount > 0.0) {
    vec3 src = color.rgb;
    vec3 hsl = rgb2hsl(src);
    float h = mod(u_colorizeHue / 360.0, 1.0);
    float s = clamp(u_colorizeSaturation / 100.0, 0.0, 1.0);
    float l = (u_colorizePreserveLum == 1)
      ? hsl.z
      : clamp(u_colorizeLightness / 100.0, -1.0, 2.0);
    vec3 recolored = hsl2rgb(vec3(h, s, l));
    float amt = clamp(u_colorizeAmount / 100.0, 0.0, 1.0);
    color.rgb = mix(src, recolored, amt);
  }
  // Tint: warm (positive) adds red/orange, cool (negative) adds blue/cyan
  if (u_tint != 0.0) {
    float tint = clamp(u_tint / 100.0, -1.0, 1.0);
    if (tint > 0.0) {
      // Warm tint: add red/orange
      color.rgb += vec3(tint * 0.3, tint * 0.1, -tint * 0.1);
    } else {
      // Cool tint: add blue/cyan
      color.rgb += vec3(-tint * 0.1, tint * 0.1, -tint * 0.3);
    }
    color.rgb = clamp(color.rgb, 0.0, 1.0);
  }
  // Sharpen (Unsharp Mask): blur -> high-pass -> mix
  if (u_sharpenAmount > 0.0) {
    float amt = clamp(u_sharpenAmount / 100.0, 0.0, 3.0);
    float radiusPx = max(0.5, u_sharpenRadius);
    // approximate blur using 9-tap box kernel scaled by radius
    vec2 texel = 1.0 / u_resolution;
    vec2 r = texel * radiusPx;
    vec3 blur = vec3(0.0);
    float w = 1.0 / 9.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        blur += texture(u_texture, uv + vec2(float(x), float(y)) * r).rgb * w;
      }
    }
    vec3 highpass = color.rgb - blur;
    // threshold in [0..1] mapped from [0..255]
    float th = clamp(u_sharpenThreshold / 255.0, 0.0, 1.0);
    highpass = mix(vec3(0.0), highpass, step(th, abs(highpass)));
    color.rgb = clamp(color.rgb + highpass * amt, 0.0, 1.0);
  }
  // Noise: add film grain noise
  if (u_noiseAmount > 0.0) {
    float noiseAmt = clamp(u_noiseAmount / 100.0, 0.0, 1.0);
    float noiseScale = max(0.1, u_noiseSize);
    vec2 noiseUV = uv * noiseScale;
    float noise = random(noiseUV) * 2.0 - 1.0; // [-1, 1]
    color.rgb += vec3(noise) * noiseAmt * 0.1;
    color.rgb = clamp(color.rgb, 0.0, 1.0);
  }
  // Gaussian Blur: multi-tap blur with Gaussian weights
  if (u_gaussianAmount > 0.0) {
    float blurAmt = clamp(u_gaussianAmount / 100.0, 0.0, 1.0);
    float radius = max(0.1, u_gaussianRadius);
    vec2 texel = 1.0 / u_resolution;
    vec2 blurSize = texel * radius;
    
    vec3 blurred = vec3(0.0);
    float totalWeight = 0.0;
    
    // 5x5 Gaussian kernel approximation
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        float weight = exp(-(float(x*x) + float(y*y)) / (2.0 * radius * radius));
        vec2 offset = vec2(float(x), float(y)) * blurSize;
        blurred += texture(u_texture, uv + offset).rgb * weight;
        totalWeight += weight;
      }
    }
    
    blurred /= totalWeight;
    color.rgb = mix(color.rgb, blurred, blurAmt);
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
