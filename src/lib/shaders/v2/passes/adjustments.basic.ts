import type { ShaderDescriptor } from "../types"

// Minimal pass that expects built-in uniforms
const VS = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FS = `
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
uniform int u_solidEnabled;
uniform vec3 u_solidColor;
uniform float u_solidAlpha;
varying vec2 v_texCoord;

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

void main(){
  vec2 uv = v_texCoord;
  vec4 color = texture2D(u_texture, uv);
  if (u_solidEnabled == 1) {
    color = vec4(u_solidColor, clamp(u_solidAlpha, 0.0, 1.0));
  }
  float b = clamp((u_brightness - 100.0) / 100.0, -1.0, 1.0);
  color.rgb = clamp(color.rgb + vec3(b), 0.0, 1.0);
  float c = clamp((u_contrast - 100.0) / 100.0, -1.0, 1.0);
  color.rgb = clamp(((color.rgb - 0.5) * (1.0 + c)) + 0.5, 0.0, 1.0);
  vec3 hsv = rgb2hsv(color.rgb);
  hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
  hsv.y *= (u_saturation / 100.0);
  color.rgb = hsv2rgb(hsv);
  color.rgb = clamp(color.rgb * pow(2.0, u_exposure / 100.0), 0.0, 1.0);
  color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
  color.rgb = pow(color.rgb, vec3(1.0 / max(0.0001, u_gamma)));
  if (u_grayscale > 0.0) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), clamp(u_grayscale / 100.0, 0.0, 1.0));
  }
  if (u_invert > 0.0) {
    color.rgb = mix(color.rgb, 1.0 - color.rgb, clamp(u_invert / 100.0, 0.0, 1.0));
  }
  if (u_sepia > 0.0) {
    vec3 sep = vec3(
      dot(color.rgb, vec3(0.393, 0.769, 0.189)),
      dot(color.rgb, vec3(0.349, 0.686, 0.168)),
      dot(color.rgb, vec3(0.272, 0.534, 0.131))
    );
    color.rgb = mix(color.rgb, sep, clamp(u_sepia / 100.0, 0.0, 1.0));
  }
  if (u_vibrance != 0.0) {
    vec3 hsv_v = rgb2hsv(color.rgb);
    float vib = clamp(u_vibrance / 100.0, -1.0, 1.0);
    if (vib >= 0.0) {
      hsv_v.y += (1.0 - hsv_v.y) * vib;
    } else {
      hsv_v.y += hsv_v.y * vib;
    }
    hsv_v.y = clamp(hsv_v.y, 0.0, 1.0);
    color.rgb = hsv2rgb(hsv_v);
  }
  color.a *= u_opacity / 100.0;
  gl_FragColor = color;
}
`

export const BasicAdjustmentsShader: ShaderDescriptor = {
  name: "adjustments.basic",
  version: "1.0.0",
  sources: { vertex: VS, fragment: FS },
  policies: { hybrid: "warm", worker: "warm" },
}
