import type { ShaderDescriptor } from "../types"

// Linearize: convert from sRGB or Display-P3 to linear. No-op if linear.
// u_colorSpace: 0=srgb, 1=linear, 2=display-p3 (treated as srgb gamma for now)
const VS = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_colorSpace;
out vec4 outColor;

// sRGB transfer function
vec3 srgbToLinear(vec3 c){
  bvec3 cutoff = lessThanEqual(c, vec3(0.04045));
  vec3 low  = c / 12.92;
  vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(high, low, vec3(cutoff));
}

void main(){
  vec4 src = texture(u_texture, v_texCoord);
  if (u_colorSpace > 0.5 && u_colorSpace < 1.5) {
    // Already linear
    outColor = src;
  } else {
    // Treat 0 (sRGB) and 2 (Display-P3) with sRGB-like OETF for now
    outColor = vec4(srgbToLinear(src.rgb), src.a);
  }
}`

export const LinearizeShader: ShaderDescriptor = {
  name: "color.linearize",
  version: "1.0.0",
  sources: { vertex: VS, fragment: FS },
  policies: { hybrid: "eager", worker: "eager" },
}
