import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const SharpenShaderDescriptor: ShaderDescriptor = {
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
uniform float u_opacity;
uniform float u_sharpenAmount;
uniform float u_sharpenRadius;
uniform float u_sharpenThreshold;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec2 uv = v_texCoord;
  vec4 color = texture(u_texture, uv);
  
  // Sharpen (Unsharp Mask): blur -> high-pass -> mix
  if (u_sharpenAmount > 0.0) {
    float amount = clamp(u_sharpenAmount / 100.0, 0.0, 3.0);
    float radiusPx = max(0.5, u_sharpenRadius);
    
    // Approximate blur using 9-tap box kernel scaled by radius
    vec2 texel = 1.0 / u_resolution;
    vec2 r = texel * radiusPx;
    vec3 blur = vec3(0.0);
    float weight = 1.0 / 9.0;
    
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        blur += texture(u_texture, uv + vec2(float(x), float(y)) * r).rgb * weight;
      }
    }
    
    // High-pass filter
    vec3 highpass = color.rgb - blur;
    
    // Threshold to avoid sharpening noise
    float threshold = clamp(u_sharpenThreshold / 255.0, 0.0, 1.0);
    highpass = mix(vec3(0.0), highpass, step(threshold, abs(highpass)));
    
    // Apply sharpening
    color.rgb = clamp(color.rgb + highpass * amount, 0.0, 1.0);
  }
  
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
