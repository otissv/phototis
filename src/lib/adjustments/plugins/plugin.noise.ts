import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  noiseAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  noiseSize: {
    min: 0.1,
    max: 5.0,
    step: 0.1,
    defaultValue: 1.0,
  },
}

const noiseShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.noise",
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
uniform float u_noiseAmount;
uniform float u_noiseSize;
in vec2 v_texCoord;
out vec4 outColor;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  
  // Noise: add film grain noise
  if (u_noiseAmount > 0.0) {
    float noiseAmount = clamp(u_noiseAmount / 100.0, 0.0, 1.0);
    float noiseScale = max(0.1, u_noiseSize);
    vec2 noiseUV = v_texCoord * noiseScale;
    float noise = random(noiseUV) * 2.0 - 1.0; // [-1, 1]
    color.rgb += vec3(noise) * noiseAmount * 0.1;
    color.rgb = clamp(color.rgb, 0.0, 1.0);
  }
  
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const noise: AdjustmentPlugin = {
  id: "noise",
  name: "Noise",
  description: "Add film grain noise to the image",
  icon: "Eclipse",
  category: "effects",
  uiSchema: [
    {
      type: "slider",
      key: "noiseAmount",
      label: "Amount",
      ...params.noiseAmount,
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "noiseSize",
      label: "Size",
      ...params.noiseSize,
      sliderType: "grayscale",
    },
  ],
  params,
  shaderDescriptor: noiseShaderDescriptor,
  toShaderParams: identityToShader,
}
