import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  temperature: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

const temperatureShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.temperature",
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
uniform float u_temperature;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Temperature: warm adds red/orange, cool adds blue
  color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
  color.rgb = clamp(color.rgb, 0.0, 1.0);
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const temperature: AdjustmentPlugin = {
  id: "temperature",
  name: "Temperature",
  category: "adjustments",
  icon: "Palette",
  description: "Adjust the temperature of the image",
  uiSchema: [
    {
      type: "slider",
      key: "temperature",
      ...params.temperature,
      sliderType: "grayscale",
    },
  ],
  params,
  shaderDescriptor: temperatureShaderDescriptor,
  toShaderParams: identityToShader,
}
