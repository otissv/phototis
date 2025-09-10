import {
  blendColor,
  blendColorBurn,
  blendColorDodge,
  blendDarken,
  blendDarkerColor,
  blendDifference,
  blendDissolve,
  blendDivide,
  blendExclusion,
  blendHardLight,
  blendHardMix,
  blendHue,
  blendLighten,
  blendLighterColor,
  blendLinearBurn,
  blendLinearDodge,
  blendLinearLight,
  blendLuminosity,
  blendMultiply,
  blendNormal,
  blendOverlay,
  blendPinLight,
  blendSaturation,
  blendScreen,
  blendSoftLight,
  blendSubtract,
  blendVividLight,
} from "./blend-plugins"
import type { BlendMode, BlendModePlugin } from "./types.blend"

const BLEND_MODE_PLUGINS: readonly BlendModePlugin[] = [
  blendNormal,
  blendMultiply,
  blendScreen,
  blendOverlay,
  blendSoftLight,
  blendHardLight,
  blendColorDodge,
  blendColorBurn,
  blendDarken,
  blendLighten,
  blendDifference,
  blendExclusion,
  blendHue,
  blendSaturation,
  blendColor,
  blendLuminosity,
  blendDissolve,
  blendLinearBurn,
  blendDarkerColor,
  blendLinearDodge,
  blendLighterColor,
  blendVividLight,
  blendLinearLight,
  blendPinLight,
  blendHardMix,
  blendSubtract,
  blendDivide,
]

const BLEND_MODE_NAMES: Readonly<Record<BlendMode, string>> = (() => {
  const names: Record<BlendMode, string> = {
    normal: "Normal",
    dissolve: "Dissolve",
    darken: "Darken",
    multiply: "Multiply",
    "color-burn": "Color Burn",
    "linear-burn": "Linear Burn",
    "darker-color": "Darker Color",
    lighten: "Lighten",
    screen: "Screen",
    "color-dodge": "Color Dodge",
    "linear-dodge": "Linear Dodge",
    "lighter-color": "Lighter Color",
    overlay: "Overlay",
    "soft-light": "Soft Light",
    "hard-light": "Hard Light",
    "vivid-light": "Vivid Light",
    "linear-light": "Linear Light",
    "pin-light": "Pin Light",
    "hard-mix": "Hard Mix",
    difference: "Difference",
    exclusion: "Exclusion",
    subtract: "Subtract",
    divide: "Divide",
    hue: "Hue",
    saturation: "Saturation",
    color: "Color",
    luminosity: "Luminosity",
  }
  for (const p of BLEND_MODE_PLUGINS) {
    names[p.id] = p.name
  }
  return names as Readonly<Record<BlendMode, string>>
})()

export { BLEND_MODE_NAMES }

export const BLEND_MODE_MAP: Readonly<Record<BlendMode, number>> = (() => {
  // Preserve legacy indices for the first 16 plugins (already ordered accordingly)
  const map: Record<BlendMode, number> = {
    normal: 0,
    dissolve: 0, // temporary, will be overwritten if present in plugins after legacy set
    darken: 0,
    multiply: 0,
    "color-burn": 0,
    "linear-burn": 0,
    "darker-color": 0,
    lighten: 0,
    screen: 0,
    "color-dodge": 0,
    "linear-dodge": 0,
    "lighter-color": 0,
    overlay: 0,
    "soft-light": 0,
    "hard-light": 0,
    "vivid-light": 0,
    "linear-light": 0,
    "pin-light": 0,
    "hard-mix": 0,
    difference: 0,
    exclusion: 0,
    subtract: 0,
    divide: 0,
    hue: 0,
    saturation: 0,
    color: 0,
    luminosity: 0,
  }
  BLEND_MODE_PLUGINS.forEach((p, idx) => {
    map[p.id] = idx
  })
  return map as Readonly<Record<BlendMode, number>>
})()

const BLEND_MODE_GLSL_HEADER = `
  // Helper functions for blend modes
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 rgb2hsl(vec3 c) {
    float maxc = max(max(c.r, c.g), c.b);
    float minc = min(min(c.r, c.g), c.b);
    float delta = maxc - minc;
    vec3 hsl = vec3(0.0, 0.0, (maxc + minc) / 2.0);
    if (delta != 0.0) {
      hsl.y = hsl.z < 0.5 ? delta / (maxc + minc) : delta / (2.0 - maxc - minc);
      float deltaR = (((maxc - c.r) / 6.0) + (delta / 2.0)) / delta;
      float deltaG = (((maxc - c.g) / 6.0) + (delta / 2.0)) / delta;
      float deltaB = (((maxc - c.b) / 6.0) + (delta / 2.0)) / delta;
      if (c.r == maxc) { hsl.x = deltaB - deltaG; }
      else if (c.g == maxc) { hsl.x = (1.0 / 3.0) + deltaR - deltaB; }
      else { hsl.x = (2.0 / 3.0) + deltaG - deltaR; }
      if (hsl.x < 0.0) hsl.x += 1.0;
      if (hsl.x > 1.0) hsl.x -= 1.0;
    }
    return hsl;
  }

  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }
`

export const BLEND_MODE_GLSL: string = (() => {
  const body = BLEND_MODE_PLUGINS.map((p) => p.glsl).join("\n\n")
  const apply = `
  vec4 applyBlendMode(vec4 base, vec4 top, int blendMode) {
${BLEND_MODE_PLUGINS.map((p, idx) => `    if (blendMode == ${idx}) return ${p.glslFunctionName}(base, top);`).join("\n")}
    return blendNormal(base, top);
  }`
  return `${BLEND_MODE_GLSL_HEADER}\n${body}\n${apply}`
})()
