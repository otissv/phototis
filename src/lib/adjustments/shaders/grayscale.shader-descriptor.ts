import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const GrayscaleShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.grayscale",
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
uniform float u_grayscale;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Grayscale: mix towards luminance using ITU-R BT.709 weights
  if (u_grayscale > 0.0) {
    float gray = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    color.rgb = mix(color.rgb, vec3(gray), clamp(u_grayscale / 100.0, 0.0, 1.0));
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
