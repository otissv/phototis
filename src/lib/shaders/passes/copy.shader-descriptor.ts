import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const VS = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 outColor;
void main(){ outColor = texture(u_texture, v_texCoord); }
`

export const CopyShader: ShaderDescriptor = {
  name: "copy",
  version: "1.0.0",
  sources: {
    vertex: VS,
    fragment: FS,
  },
  policies: { hybrid: "eager", worker: "eager" },
}
