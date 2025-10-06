import type { ShaderDescriptor } from "@/lib/shaders/types.shader"
import type { AdjustmentPlugin } from "../registry"

const params = {
  invert: {
    defaultValue: 0,
  },
}

const invertShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.invert",
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
uniform float u_invert;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Invert: blend between original and inverted colors
  if (u_invert > 0.0) {
    color.rgb = mix(color.rgb, 1.0 - color.rgb, clamp(u_invert / 100.0, 0.0, 1.0));
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const invert: AdjustmentPlugin = {
  id: "invert",
  name: "Invert",
  category: "adjustments",
  icon: "Eclipse",
  description: "Invert the colors of the image",
  uiSchema: [{ type: "toggle", key: "invert" }],
  params,
  shaderDescriptor: invertShaderDescriptor,
  toShaderParams: (params) => {
    const value = Number((params as any).invert || 0)
    return { invert: value }
  },
}
