import type { ShaderDescriptor } from "../types"

// Vertex places a [0..1] quad in clip space using layer and canvas metrics.
// Contract (frozen):
// - a_position: [0..1] quad
// - a_texCoord: [0..1] uv (layer space)
// - u_layerSize: vec2 in pixels
// - u_canvasSize: vec2 in pixels
// - u_layerPosition: vec2 center position in canvas pixels (top-left origin)
// - u_transform: mat3 applied in layer-local pixel space around the center
const VS = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
uniform vec2 u_layerSize;
uniform vec2 u_canvasSize;
uniform vec2 u_layerPosition;
uniform mat3 u_transform;
void main(){
  // Layer-local pixel coords centered at (0,0)
  vec2 p = (a_position - vec2(0.5)) * u_layerSize;
  // Apply 2D affine transform (scale/rotate/flip/translate)
  vec3 tp = u_transform * vec3(p, 1.0);
  vec2 pixel = tp.xy + u_layerPosition;
  // Canvas pixels -> NDC (invert Y)
  vec2 ndc = vec2(
    (pixel.x / u_canvasSize.x) * 2.0 - 1.0,
    1.0 - (pixel.y / u_canvasSize.y) * 2.0
  );
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`

const FS = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 outColor;
void main(){
  // Uploaded bitmaps are stored with a top-left origin (UNPACK_FLIP_Y_WEBGL=false).
  // Flip V here to sample them upright regardless of buffer policy.
  vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
  outColor = texture(u_texture, uv);
}`

export const LayerRenderShader: ShaderDescriptor = {
  name: "layer.render",
  version: "1.0.0",
  sources: {
    vertex: VS,
    fragment: FS,
  },
  policies: { hybrid: "eager", worker: "eager" },
}
