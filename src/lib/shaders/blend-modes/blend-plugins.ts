// KF-MIGRATE: Blend plugins unchanged; ensure layer opacity and related params come from sampled Tracks at time t.
import type { BlendModePlugin } from "./types.blend"

export const blendNormal: BlendModePlugin = {
  id: "normal",
  name: "Normal",
  glslFunctionName: "blendNormal",
  glsl: `
vec4 blendNormal(vec4 base, vec4 top) {
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 result = (top.rgb * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(result, alpha);
}`,
}

export const blendMultiply: BlendModePlugin = {
  id: "multiply",
  name: "Multiply",
  glslFunctionName: "blendMultiply",
  glsl: `
vec4 blendMultiply(vec4 base, vec4 top) {
  vec3 result = base.rgb * top.rgb;
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendScreen: BlendModePlugin = {
  id: "screen",
  name: "Screen",
  glslFunctionName: "blendScreen",
  glsl: `
vec4 blendScreen(vec4 base, vec4 top) {
  vec3 result = 1.0 - (1.0 - base.rgb) * (1.0 - top.rgb);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendSoftLight: BlendModePlugin = {
  id: "soft-light",
  name: "Soft Light",
  glslFunctionName: "blendSoftLight",
  glsl: `
vec4 blendSoftLight(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (top[i] < 0.5) {
      result[i] = base[i] * (2.0 * top[i] + (1.0 - 2.0 * top[i]) * base[i]);
    } else {
      result[i] = base[i] * (1.0 - 2.0 * top[i]) + sqrt(base[i]) * (2.0 * top[i] - 1.0);
    }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendHardLight: BlendModePlugin = {
  id: "hard-light",
  name: "Hard Light",
  glslFunctionName: "blendHardLight",
  glsl: `
vec4 blendHardLight(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (top[i] < 0.5) { result[i] = 2.0 * base[i] * top[i]; }
    else { result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - top[i]); }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendOverlay: BlendModePlugin = {
  id: "overlay",
  name: "Overlay",
  glslFunctionName: "blendOverlay",
  glsl: `
vec4 blendOverlay(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (base[i] < 0.5) { result[i] = 2.0 * base[i] * top[i]; }
    else { result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - top[i]); }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendColorDodge: BlendModePlugin = {
  id: "color-dodge",
  name: "Color Dodge",
  glslFunctionName: "blendColorDodge",
  glsl: `
vec4 blendColorDodge(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (top[i] >= 1.0) { result[i] = 1.0; }
    else { result[i] = min(1.0, base[i] / (1.0 - top[i])); }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendColorBurn: BlendModePlugin = {
  id: "color-burn",
  name: "Color Burn",
  glslFunctionName: "blendColorBurn",
  glsl: `
vec4 blendColorBurn(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (top[i] <= 0.0) { result[i] = 0.0; }
    else { result[i] = 1.0 - min(1.0, (1.0 - base[i]) / top[i]); }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendDarken: BlendModePlugin = {
  id: "darken",
  name: "Darken",
  glslFunctionName: "blendDarken",
  glsl: `
vec4 blendDarken(vec4 base, vec4 top) {
  vec3 result = min(base.rgb, top.rgb);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendLighten: BlendModePlugin = {
  id: "lighten",
  name: "Lighten",
  glslFunctionName: "blendLighten",
  glsl: `
vec4 blendLighten(vec4 base, vec4 top) {
  vec3 result = max(base.rgb, top.rgb);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendDifference: BlendModePlugin = {
  id: "difference",
  name: "Difference",
  glslFunctionName: "blendDifference",
  glsl: `
vec4 blendDifference(vec4 base, vec4 top) {
  vec3 result = abs(base.rgb - top.rgb);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendExclusion: BlendModePlugin = {
  id: "exclusion",
  name: "Exclusion",
  glslFunctionName: "blendExclusion",
  glsl: `
vec4 blendExclusion(vec4 base, vec4 top) {
  vec3 result = base.rgb + top.rgb - 2.0 * base.rgb * top.rgb;
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendHue: BlendModePlugin = {
  id: "hue",
  name: "Hue",
  glslFunctionName: "blendHue",
  glsl: `
vec4 blendHue(vec4 base, vec4 top) {
  vec3 baseHSL = rgb2hsl(base.rgb);
  vec3 topHSL = rgb2hsl(top.rgb);
  vec3 result = hsl2rgb(vec3(topHSL.x, baseHSL.y, baseHSL.z));
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendSaturation: BlendModePlugin = {
  id: "saturation",
  name: "Saturation",
  glslFunctionName: "blendSaturation",
  glsl: `
vec4 blendSaturation(vec4 base, vec4 top) {
  vec3 baseHSL = rgb2hsl(base.rgb);
  vec3 topHSL = rgb2hsl(top.rgb);
  vec3 result = hsl2rgb(vec3(baseHSL.x, topHSL.y, baseHSL.z));
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendColor: BlendModePlugin = {
  id: "color",
  name: "Color",
  glslFunctionName: "blendColor",
  glsl: `
vec4 blendColor(vec4 base, vec4 top) {
  vec3 baseHSL = rgb2hsl(base.rgb);
  vec3 topHSL = rgb2hsl(top.rgb);
  vec3 result = hsl2rgb(vec3(topHSL.x, topHSL.y, baseHSL.z));
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendLuminosity: BlendModePlugin = {
  id: "luminosity",
  name: "Luminosity",
  glslFunctionName: "blendLuminosity",
  glsl: `
vec4 blendLuminosity(vec4 base, vec4 top) {
  vec3 baseHSL = rgb2hsl(base.rgb);
  vec3 topHSL = rgb2hsl(top.rgb);
  vec3 result = hsl2rgb(vec3(baseHSL.x, baseHSL.y, topHSL.z));
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendDissolve: BlendModePlugin = {
  id: "dissolve",
  name: "Dissolve",
  glslFunctionName: "blendDissolve",
  glsl: `
float rand(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}
vec4 blendDissolve(vec4 base, vec4 top) {
  float m = step(rand(gl_FragCoord.xy), clamp(top.a, 0.0, 1.0));
  vec4 t = vec4(top.rgb, m);
  float alpha = t.a + base.a * (1.0 - t.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 result = (t.rgb * t.a + base.rgb * base.a * (1.0 - t.a)) / alpha;
  return vec4(result, alpha);
}`,
}

export const blendLinearBurn: BlendModePlugin = {
  id: "linear-burn",
  name: "Linear Burn",
  glslFunctionName: "blendLinearBurn",
  glsl: `
vec4 blendLinearBurn(vec4 base, vec4 top) {
  vec3 result = clamp(base.rgb + top.rgb - 1.0, 0.0, 1.0);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendDarkerColor: BlendModePlugin = {
  id: "darker-color",
  name: "Darker Color",
  glslFunctionName: "blendDarkerColor",
  glsl: `
vec4 blendDarkerColor(vec4 base, vec4 top) {
  float bSum = base.r + base.g + base.b;
  float tSum = top.r + top.g + top.b;
  vec3 result = (bSum <= tSum) ? base.rgb : top.rgb;
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendLinearDodge: BlendModePlugin = {
  id: "linear-dodge",
  name: "Linear Dodge",
  glslFunctionName: "blendLinearDodge",
  glsl: `
vec4 blendLinearDodge(vec4 base, vec4 top) {
  vec3 result = clamp(base.rgb + top.rgb, 0.0, 1.0);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendLighterColor: BlendModePlugin = {
  id: "lighter-color",
  name: "Lighter Color",
  glslFunctionName: "blendLighterColor",
  glsl: `
vec4 blendLighterColor(vec4 base, vec4 top) {
  float bSum = base.r + base.g + base.b;
  float tSum = top.r + top.g + top.b;
  vec3 result = (bSum >= tSum) ? base.rgb : top.rgb;
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendVividLight: BlendModePlugin = {
  id: "vivid-light",
  name: "Vivid Light",
  glslFunctionName: "blendVividLight",
  glsl: `
vec4 blendVividLight(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    float b = top[i];
    float a = base[i];
    if (b < 0.5) {
      float t = 2.0 * b; // [0..1]
      if (t <= 0.0) result[i] = 0.0;
      else result[i] = 1.0 - min(1.0, (1.0 - a) / t);
    } else {
      float t = 2.0 * (b - 0.5); // [0..1]
      if (t >= 1.0) result[i] = 1.0;
      else result[i] = min(1.0, a / (1.0 - t));
    }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendLinearLight: BlendModePlugin = {
  id: "linear-light",
  name: "Linear Light",
  glslFunctionName: "blendLinearLight",
  glsl: `
vec4 blendLinearLight(vec4 base, vec4 top) {
  vec3 result = clamp(base.rgb + 2.0 * top.rgb - 1.0, 0.0, 1.0);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendPinLight: BlendModePlugin = {
  id: "pin-light",
  name: "Pin Light",
  glslFunctionName: "blendPinLight",
  glsl: `
vec4 blendPinLight(vec4 base, vec4 top) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    float b = top[i];
    float a = base[i];
    if (b < 0.5) { result[i] = min(a, 2.0 * b); }
    else { result[i] = max(a, 2.0 * b - 1.0); }
  }
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendHardMix: BlendModePlugin = {
  id: "hard-mix",
  name: "Hard Mix",
  glslFunctionName: "blendHardMix",
  glsl: `
vec4 blendHardMix(vec4 base, vec4 top) {
  // Compute vivid light then threshold
  vec4 vivid = blendVividLight(base, top);
  vec3 result = step(vec3(0.5), vivid.rgb);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendSubtract: BlendModePlugin = {
  id: "subtract",
  name: "Subtract",
  glslFunctionName: "blendSubtract",
  glsl: `
vec4 blendSubtract(vec4 base, vec4 top) {
  vec3 result = clamp(base.rgb - top.rgb, 0.0, 1.0);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}

export const blendDivide: BlendModePlugin = {
  id: "divide",
  name: "Divide",
  glslFunctionName: "blendDivide",
  glsl: `
vec4 blendDivide(vec4 base, vec4 top) {
  vec3 result = clamp(base.rgb / max(top.rgb, vec3(0.00001)), 0.0, 1.0);
  float alpha = top.a + base.a * (1.0 - top.a);
  if (alpha < 0.001) return vec4(0.0);
  vec3 compositedResult = (result * top.a + base.rgb * base.a * (1.0 - top.a)) / alpha;
  return vec4(compositedResult, alpha);
}`,
}
