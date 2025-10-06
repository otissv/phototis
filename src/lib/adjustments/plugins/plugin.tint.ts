import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  tint: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

const tintShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.tint",
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
uniform float u_tint;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
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
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const tintPlugin: AdjustmentPlugin = {
  id: "tint",
  name: "Tint",
  category: "adjustments",
  icon: "Palette",
  description: "Add warm (positive) or cool (negative) tint",
  capabilities: ["Designer", "Motion", "Pro"],
  uiSchema: [
    {
      type: "slider",
      key: "tint",
      sliderType: "grayscale",
      ...params.tint,
    },
  ],
  params,
  shaderDescriptor: tintShaderDescriptor,
  toShaderParams: identityToShader,
}
