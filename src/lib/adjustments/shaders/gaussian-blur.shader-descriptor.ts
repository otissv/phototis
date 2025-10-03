import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const GaussianBlurShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.gaussian_blur",
  version: "1.0.0",
  passes: [
    {
      id: "horizontal_blur",
      fragmentSource: `#version 300 es
precision highp float;
uniform sampler2D u_channel0;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_opacity;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec4 color = vec4(0.0);
  float totalWeight = 0.0;
  
  // Horizontal blur pass
  for (int i = -4; i <= 4; i++) {
    float weight = exp(-(float(i * i)) / (2.0 * u_radius * u_radius));
    vec2 offset = vec2(float(i), 0.0) * texel;
    color += texture(u_channel0, v_texCoord + offset) * weight;
    totalWeight += weight;
  }
  
  color /= totalWeight;
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
      channels: [{ name: "u_channel0", semantic: "currentLayer" }],
    },
    {
      id: "vertical_blur",
      fragmentSource: `#version 300 es
precision highp float;
uniform sampler2D u_channel0; // original
uniform sampler2D u_channel1; // blurred from horizontal pass
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_amount;
uniform float u_opacity;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec4 blurred = vec4(0.0);
  float totalWeight = 0.0;
  
  // Vertical blur pass on the horizontally blurred texture
  for (int i = -4; i <= 4; i++) {
    float weight = exp(-(float(i * i)) / (2.0 * u_radius * u_radius));
    vec2 offset = vec2(0.0, float(i)) * texel;
    blurred += texture(u_channel1, v_texCoord + offset) * weight;
    totalWeight += weight;
  }
  
  blurred /= totalWeight;
  
  // Sample original for mixing
  vec4 original = texture(u_channel0, v_texCoord);
  
  // Mix between original and blurred based on amount
  vec4 color = mix(original, blurred, clamp(u_amount / 100.0, 0.0, 1.0));
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
      channels: [
        { name: "u_channel0", semantic: "currentLayer" },
        { name: "u_channel1", semantic: "previousPass" },
      ],
      inputs: ["horizontal_blur"],
    },
  ],
  policies: { hybrid: "warm", worker: "warm" },
}
