import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  vibrance: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
}

const vibranceShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.vibrance",
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
uniform float u_opacity;
uniform float u_vibrance;
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
  vec4 K = vec4(1., 2.0/3., 1./3., 3.);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
}

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Vibrance: boost saturation more for low-saturation colors
  if (u_vibrance != 0.0) {
    vec3 hsv = rgb2hsv(color.rgb);
    float vibrance = clamp(u_vibrance / 100.0, -1.0, 1.0);
    if (vibrance >= 0.0) {
      // Increase low-saturation colors more than high-saturation
      hsv.y += (1.0 - hsv.y) * vibrance;
    } else {
      // Reduce saturation uniformly
      hsv.y += hsv.y * vibrance;
    }
    hsv.y = clamp(hsv.y, 0.0, 1.0);
    color.rgb = hsv2rgb(hsv);
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const vibrance: AdjustmentPlugin = {
  id: "vibrance",
  name: "Vibrance",
  category: "adjustments",
  icon: "Sparkles",
  description: "Adjust the vibrance of the image",
  uiSchema: [
    {
      type: "slider",
      key: "vibrance",
      sliderType: "grayscale",
      ...params.vibrance,
    },
  ],
  params,
  shaderDescriptor: vibranceShaderDescriptor,
  toShaderParams: identityToShader,
}
