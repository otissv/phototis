import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  sharpenAmount: {
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 0,
  },
  sharpenRadius: {
    min: 0.1,
    max: 10,
    step: 0.1,
    defaultValue: 1.5,
  },
  sharpenThreshold: {
    min: 0,
    max: 255,
    step: 1,
    defaultValue: 0,
  },
}

const sharpenShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.sharpen",
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
uniform vec2 u_resolution;
uniform float u_opacity;          // [0..100]
uniform float u_sharpenAmount;    // [0..100]
uniform float u_sharpenRadius;    // pixels
uniform float u_sharpenThreshold; // [0..255]
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec2 uv = v_texCoord;
  vec4 src = texture(u_texture, uv);

  float amount = clamp(u_sharpenAmount / 100.0, 0.0, 4.0);
  if (amount > 0.0) {
    float radiusPx = clamp(u_sharpenRadius, 0.25, 32.0);
    vec2 texel = 1.0 / max(u_resolution, vec2(1.0));

    // Simple box blur approximation for unsharp mask
    vec3 sum = vec3(0.0);
    float total = 0.0;
    int radius = int(clamp(radiusPx, 1.0, 8.0));
    
    for (int x = -8; x <= 8; x++) {
      for (int y = -8; y <= 8; y++) {
        if (x > radius || y > radius) continue;
        vec2 offset = vec2(float(x), float(y)) * texel;
        vec2 sampleUV = uv + offset;
        // Clamp to prevent sampling outside texture
        sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));
        sum += texture(u_texture, sampleUV).rgb;
        total += 1.0;
      }
    }
    
    vec3 blurred = sum / max(total, 1.0);

    // High-pass filter
    vec3 highpass = src.rgb - blurred;

    // Soft thresholding
    float t = clamp(u_sharpenThreshold / 255.0, 0.0, 1.0);
    vec3 m = smoothstep(vec3(t), vec3(1.0), abs(highpass));
    highpass *= m;

    // Apply sharpening
    vec3 sharpened = clamp(src.rgb + highpass * amount, 0.0, 1.0);
    src.rgb = sharpened;
  }

  src.a *= u_opacity / 100.0;
  outColor = src;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const sharpen: AdjustmentPlugin = {
  id: "sharpen",
  name: "Sharpen",
  description: "Unsharp mask sharpening",
  category: "effects",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "sharpenAmount",
      label: "Amount",
      ...params.sharpenAmount,
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "sharpenRadius",
      label: "Radius",
      ...params.sharpenRadius,
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "sharpenThreshold",
      label: "Threshold",
      ...params.sharpenThreshold,
      sliderType: "grayscale",
    },
  ],
  params,
  shaderDescriptor: sharpenShaderDescriptor,
  toShaderParams: identityToShader,
}
