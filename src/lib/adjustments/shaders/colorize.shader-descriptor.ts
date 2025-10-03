import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export const ColorizeShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.colorize",
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
uniform float u_colorizeHue;
uniform float u_colorizeSaturation;
uniform float u_colorizeLightness;
uniform int u_colorizePreserveLum;
uniform float u_colorizeAmount;
in vec2 v_texCoord;
out vec4 outColor;

vec3 rgb2hsl(vec3 c){
  float r = c.r, g = c.g, b = c.b;
  float maxc = max(max(r, g), b);
  float minc = min(min(r, g), b);
  float h = 0.0;
  float s = 0.0;
  float l = (maxc + minc) * 0.5;
  if (maxc != minc) {
    float d = maxc - minc;
    s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
    if (maxc == r) h = (g - b) / d + (g < b ? 6.0 : 0.0);
    else if (maxc == g) h = (b - r) / d + 2.0;
    else h = (r - g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t){
  if(t < 0.0) t += 1.0;
  if(t > 1.0) t -= 1.0;
  if(t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if(t < 1.0/2.0) return q;
  if(t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl){
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s == 0.0) return vec3(l, l, l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  float r = hue2rgb(p, q, h + 1.0/3.0);
  float g = hue2rgb(p, q, h);
  float b = hue2rgb(p, q, h - 1.0/3.0);
  return vec3(r, g, b);
}

void main(){
  vec4 color = texture(u_texture, v_texCoord);
  // Colorize: apply HSL color shift optionally preserving luminance
  if (u_colorizeAmount > 0.0) {
    vec3 src = color.rgb;
    vec3 hsl = rgb2hsl(src);
    float h = mod(u_colorizeHue / 360.0, 1.0);
    float s = clamp(u_colorizeSaturation / 100.0, 0.0, 1.0);
    float l = (u_colorizePreserveLum == 1)
      ? hsl.z
      : clamp(u_colorizeLightness / 100.0, -1.0, 2.0);
    vec3 recolored = hsl2rgb(vec3(h, s, l));
    float amount = clamp(u_colorizeAmount / 100.0, 0.0, 1.0);
    color.rgb = mix(src, recolored, amount);
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}
