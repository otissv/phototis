import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  sepia: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

const sepiaShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.sepia",
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
uniform float u_sepia;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Sepia: apply brownish tint using weighted dot products
  if (u_sepia > 0.0) {
    vec3 sepiaColor = vec3(
      dot(color.rgb, vec3(0.393, 0.769, 0.189)),
      dot(color.rgb, vec3(0.349, 0.686, 0.168)),
      dot(color.rgb, vec3(0.272, 0.534, 0.131))
    );
    color.rgb = mix(color.rgb, sepiaColor, clamp(u_sepia / 100.0, 0.0, 1.0));
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const sepia: AdjustmentPlugin = {
  id: "sepia",
  name: "Sepia",
  category: "adjustments",
  icon: "Eclipse",
  description: "Adjust the sepia of the image",
  uiSchema: [
    {
      type: "slider",
      key: "sepia",
      sliderType: "grayscale",
      ...params.sepia,
    },
  ],
  params,
  shaderDescriptor: sepiaShaderDescriptor,
  toShaderParams: identityToShader,
}
