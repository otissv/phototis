import type { ShaderDescriptor } from "../types"

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

void main(){
  vec2 uv = v_texCoord;
  vec4 color = texture(u_texture, uv);
  color.rgb *= (u_brightness / 100.0);
  color.rgb = ((color.rgb - 0.5) * (u_contrast / 100.0)) + 0.5;
  vec3 hsv = rgb2hsv(color.rgb);
  hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
  hsv.y *= (u_saturation / 100.0);
  color.rgb = hsv2rgb(hsv);
  color.rgb *= pow(2.0, u_exposure / 100.0);
  color.rgb = pow(color.rgb, vec3(1.0 / max(0.0001, u_gamma)));
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
