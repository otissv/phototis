import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  brightness: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
}

const brightnessShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.brightness",
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
uniform float u_brightness;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Brightness: additive adjustment [-1..1] from slider [0..200]
  float brightness = clamp((u_brightness - 100.0) / 100.0, -1.0, 1.0);
  color.rgb = clamp(color.rgb + vec3(brightness), 0.0, 1.0);
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const brightness: AdjustmentPlugin = {
  id: "brightness",
  name: "Brightness",
  description: "Adjust the brightness of the image",
  category: "adjustments",
  icon: "Sun",
  uiSchema: [
    {
      type: "slider",
      key: "brightness",
      sliderType: "grayscale",
      ...params.brightness,
    },
  ],
  params: params,
  shaderDescriptor: brightnessShaderDescriptor,
  toShaderParams: identityToShader,
}
