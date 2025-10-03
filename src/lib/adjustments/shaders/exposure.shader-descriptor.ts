import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const ExposureShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.exposure",
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
uniform float u_exposure;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Exposure: multiplicative adjustment using 2^(exposure/100)
  color.rgb = clamp(color.rgb * pow(2.0, u_exposure / 100.0), 0.0, 1.0);
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
