import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const solidShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.solid",
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
uniform float u_opacity;
uniform int u_solidEnabled;
uniform vec3 u_solidColor;
uniform float u_solidAlpha;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color;
  // Solid overlay renders a single color
  if (u_solidEnabled == 1) {
    color = vec4(u_solidColor, clamp(u_solidAlpha, 0.0, 1.0));
  } else {
    color = vec4(0.0, 0.0, 0.0, 0.0);
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
