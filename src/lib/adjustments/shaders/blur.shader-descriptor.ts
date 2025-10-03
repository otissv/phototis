import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

// Separable Gaussian blur (two-pass) with direction
const VS = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main(){ v_texCoord=a_texCoord; gl_Position=vec4(a_position,0.,1.); }
`

const FS_H = `
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_blur; // 0..100
varying vec2 v_texCoord;
void main(){
  float radius = max(0.0, u_blur) * 0.125; // tune
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i=-8;i<=8;i++){
    float x = float(i);
    float w = exp(-(x*x)/(2.0*max(0.001,radius)));
    vec2 uv = v_texCoord + vec2(x,0.0)*u_texelSize;
    sum += texture2D(u_texture, uv) * w;
    wsum += w;
  }
  gl_FragColor = sum / max(0.0001, wsum);
}
`

const FS_V = `
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_blur; // 0..100
varying vec2 v_texCoord;
void main(){
  float radius = max(0.0, u_blur) * 0.125;
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i=-8;i<=8;i++){
    float y = float(i);
    float w = exp(-(y*y)/(2.0*max(0.001,radius)));
    vec2 uv = v_texCoord + vec2(0.0,y)*u_texelSize;
    sum += texture2D(u_texture, uv) * w;
    wsum += w;
  }
  gl_FragColor = sum / max(0.0001, wsum);
}
`

export const BlurSeparableDescriptor: ShaderDescriptor = {
  name: "blur.separable",
  version: "1.0.0",
  passes: [
    {
      id: "h",
      vertexSource: VS,
      fragmentSource: FS_H,
      uniforms: { u_blur: 0 },
      channels: [{ name: "u_texture", semantic: "previousPass" }],
    },
    {
      id: "v",
      vertexSource: VS,
      fragmentSource: FS_V,
      uniforms: { u_blur: 0 },
      inputs: ["h"],
      channels: [{ name: "u_texture", semantic: "previousPass" }],
    },
  ],
  policies: { hybrid: "warm", worker: "warm" },
}
