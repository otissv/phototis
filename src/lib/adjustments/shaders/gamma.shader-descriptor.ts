import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const GammaShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.gamma",
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
uniform float u_gamma;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Gamma: power curve correction for display linearization
  color.rgb = pow(color.rgb, vec3(1.0 / max(0.0001, u_gamma)));
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
