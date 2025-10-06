import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  gaussianAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  gaussianRadius: {
    min: 0.1,
    max: 10,
    step: 0.1,
    defaultValue: 1.0,
  },
}

const gaussianBlurShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.gaussian_blur",
  version: "1.0.0",
  passes: [
    {
      id: "horizontal_blur",
      fragmentSource: `#version 300 es
precision highp float;
uniform sampler2D u_channel0;
uniform vec2 u_resolution;
uniform float u_radius;   // blur radius in pixels
uniform float u_opacity;  // [0..100]
in vec2 v_texCoord;
out vec4 outColor;

float gauss(float x, float sigma){
  return exp(-(x*x) / (2.0 * sigma * sigma));
}

void main() {
  vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
  float radiusPx = clamp(u_radius, 0.1, 64.0);
  // Use sigma from radius (common approx): radius ≈ 2*sigma
  float sigma = max(0.5, radiusPx * 0.5);
  int taps = int(clamp(ceil(radiusPx) * 2.0 + 1.0, 5.0, 33.0));

  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  // Center sample
  float w0 = gauss(0.0, sigma);
  sum += texture(u_channel0, v_texCoord) * w0;
  wsum += w0;
  // Symmetric taps
  for (int i = 1; i < 64; i++) {
    if (i >= taps/2 + 1) break;
    float x = float(i);
    float w = gauss(x, sigma);
    vec2 off = vec2(x, 0.0) * texel;
    sum += texture(u_channel0, v_texCoord + off) * w;
    sum += texture(u_channel0, v_texCoord - off) * w;
    wsum += 2.0 * w;
  }

  vec4 color = sum / max(wsum, 1e-6);
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
uniform sampler2D u_channel1; // horizontally blurred
uniform vec2 u_resolution;
uniform float u_radius;   // blur radius in pixels
uniform float u_amount;   // [0..100]
uniform float u_opacity;  // [0..100]
in vec2 v_texCoord;
out vec4 outColor;

float gauss(float x, float sigma){
  return exp(-(x*x) / (2.0 * sigma * sigma));
}

void main() {
  vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
  float radiusPx = clamp(u_radius, 0.1, 64.0);
  float sigma = max(0.5, radiusPx * 0.5);
  int taps = int(clamp(ceil(radiusPx) * 2.0 + 1.0, 5.0, 33.0));

  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  // Center sample
  float w0 = gauss(0.0, sigma);
  sum += texture(u_channel1, v_texCoord) * w0;
  wsum += w0;
  // Symmetric taps
  for (int i = 1; i < 64; i++) {
    if (i >= taps/2 + 1) break;
    float y = float(i);
    float w = gauss(y, sigma);
    vec2 off = vec2(0.0, y) * texel;
    sum += texture(u_channel1, v_texCoord + off) * w;
    sum += texture(u_channel1, v_texCoord - off) * w;
    wsum += 2.0 * w;
  }

  vec4 blurred = sum / max(wsum, 1e-6);
  vec4 original = texture(u_channel0, v_texCoord);
  float amt = clamp(u_amount / 100.0, 0.0, 1.0);
  vec4 color = mix(original, blurred, amt);
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

export const gaussian: AdjustmentPlugin = {
  id: "gaussian",
  name: "Gaussian Blur",
  description: "Apply Gaussian blur to the image",
  category: "effects",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "gaussianAmount",
      label: "Amount",
      sliderType: "grayscale",
      ...params.gaussianAmount,
    },
    {
      type: "slider",
      key: "gaussianRadius",
      label: "Radius",
      sliderType: "grayscale",
      ...params.gaussianRadius,
    },
  ],
  params,
  shaderDescriptor: gaussianBlurShaderDescriptor,
  toShaderParams: identityToShader,
}
