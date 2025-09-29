import type { ShaderDescriptor } from "@/lib/shaders/types.shader"
import { BLEND_MODE_GLSL } from "@/lib/shaders/shared/blend-glsl"

const VS = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_baseTexture;
uniform sampler2D u_topTexture;
uniform float u_opacity; // 0..100
uniform float u_blendMode; // cast to int in shader
uniform sampler2D u_maskTexture; // optional
uniform float u_hasMask; // 0 or 1
// u_maskParams: x=invert(0/1), y=feather(px, unused here), z=opacity(0..1), w=mode(0 add,1 subtract,2 intersect,3 difference)
uniform vec4 u_maskParams;
out vec4 outColor;
${BLEND_MODE_GLSL}
void main(){
  vec2 uv = v_texCoord;
  vec4 baseColor = texture(u_baseTexture, uv);
  vec4 topColor  = texture(u_topTexture,  uv);
  topColor.a *= (u_opacity / 100.0);
  if (u_hasMask > 0.5) {
    float mask = texture(u_maskTexture, uv).r;
    if (u_maskParams.x > 0.5) {
      mask = 1.0 - mask; // invert
    }
    // feather (u_maskParams.y) intentionally ignored for now
    float mOpacity = clamp(u_maskParams.z, 0.0, 1.0);
    mask = clamp(mask * mOpacity, 0.0, 1.0);
    int mode = int(u_maskParams.w + 0.5);
    if (mode == 0) {
      topColor.a *= mask; // add
    } else if (mode == 1) {
      topColor.a *= (1.0 - mask); // subtract
    } else if (mode == 2) {
      topColor.a *= mask; // intersect (same as add weighting)
    } else {
      // difference: emphasize edges roughly
      topColor.a *= abs(mask - 0.5) * 2.0;
    }
  }
  outColor = applyBlendMode(baseColor, topColor, int(u_blendMode));
}`

export const CompositorShader: ShaderDescriptor = {
  name: "compositor",
  version: "1.0.0",
  sources: {
    vertex: VS,
    fragment: FS,
  },
  policies: { hybrid: "eager", worker: "eager" },
}
