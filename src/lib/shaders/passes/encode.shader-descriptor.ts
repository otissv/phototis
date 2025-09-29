import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

// Encode: convert from linear to display transfer function.
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

vec3 linearToSrgb(vec3 c){
  bvec3 cutoff = lessThanEqual(c, vec3(0.0031308));
  vec3 low  = c * 12.92;
  vec3 high = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055;
  return mix(high, low, vec3(cutoff));
}

void main(){
  vec4 src = texture(u_texture, v_texCoord);
  if (u_colorSpace > 0.5 && u_colorSpace < 1.5) {
    // Linear output requested
    outColor = src;
  } else {
    // Treat 0 (sRGB) and 2 (Display-P3) with sRGB-like EOTF for now
    outColor = vec4(linearToSrgb(src.rgb), src.a);
  }
}`

export const EncodeShader: ShaderDescriptor = {
  name: "color.encode",
  version: "1.0.0",
  sources: { vertex: VS, fragment: FS },
  policies: { hybrid: "eager", worker: "eager" },
}
