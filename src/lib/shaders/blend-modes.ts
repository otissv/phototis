export type BlendMode = 
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "color-dodge"
  | "color-burn"
  | "darken"
  | "lighten"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"

export const BLEND_MODE_MAP: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  "soft-light": 4,
  "hard-light": 5,
  "color-dodge": 6,
  "color-burn": 7,
  darken: 8,
  lighten: 9,
  difference: 10,
  exclusion: 11,
  hue: 12,
  saturation: 13,
  color: 14,
  luminosity: 15,
}

export const BLEND_MODE_NAMES: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  "soft-light": "Soft Light",
  "hard-light": "Hard Light",
  "color-dodge": "Color Dodge",
  "color-burn": "Color Burn",
  darken: "Darken",
  lighten: "Lighten",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity",
}

export const BLEND_MODE_GLSL = `
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
      
      if (c.r == maxc) {
        hsl.x = deltaB - deltaG;
      } else if (c.g == maxc) {
        hsl.x = (1.0 / 3.0) + deltaR - deltaB;
      } else {
        hsl.x = (2.0 / 3.0) + deltaG - deltaR;
      }
      
      if (hsl.x < 0.0) hsl.x += 1.0;
      if (hsl.x > 1.0) hsl.x -= 1.0;
    }
    
    return hsl;
  }

  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  // Blend mode functions
  vec4 blendNormal(vec4 base, vec4 top) {
    return mix(base, top, top.a);
  }

  vec4 blendMultiply(vec4 base, vec4 top) {
    return vec4(base.rgb * top.rgb, top.a);
  }

  vec4 blendScreen(vec4 base, vec4 top) {
    return vec4(1.0 - (1.0 - base.rgb) * (1.0 - top.rgb), top.a);
  }

  vec4 blendOverlay(vec4 base, vec4 top) {
    vec3 result;
    for (int i = 0; i < 3; i++) {
      if (base[i] < 0.5) {
        result[i] = 2.0 * base[i] * top[i];
      } else {
        result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - top[i]);
      }
    }
    return vec4(result, top.a);
  }

  vec4 blendSoftLight(vec4 base, vec4 top) {
    vec3 result;
    for (int i = 0; i < 3; i++) {
      if (top[i] < 0.5) {
        result[i] = base[i] * (2.0 * top[i] + (1.0 - 2.0 * top[i]) * base[i]);
      } else {
        result[i] = base[i] * (1.0 - 2.0 * top[i]) + sqrt(base[i]) * (2.0 * top[i] - 1.0);
      }
    }
    return vec4(result, top.a);
  }

  vec4 blendHardLight(vec4 base, vec4 top) {
    vec3 result;
    for (int i = 0; i < 3; i++) {
      if (top[i] < 0.5) {
        result[i] = 2.0 * base[i] * top[i];
      } else {
        result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - top[i]);
      }
    }
    return vec4(result, top.a);
  }

  vec4 blendColorDodge(vec4 base, vec4 top) {
    vec3 result;
    for (int i = 0; i < 3; i++) {
      if (top[i] == 1.0) {
        result[i] = 1.0;
      } else {
        result[i] = min(1.0, base[i] / (1.0 - top[i]));
      }
    }
    return vec4(result, top.a);
  }

  vec4 blendColorBurn(vec4 base, vec4 top) {
    vec3 result;
    for (int i = 0; i < 3; i++) {
      if (top[i] == 0.0) {
        result[i] = 0.0;
      } else {
        result[i] = 1.0 - min(1.0, (1.0 - base[i]) / top[i]);
      }
    }
    return vec4(result, top.a);
  }

  vec4 blendDarken(vec4 base, vec4 top) {
    return vec4(min(base.rgb, top.rgb), top.a);
  }

  vec4 blendLighten(vec4 base, vec4 top) {
    return vec4(max(base.rgb, top.rgb), top.a);
  }

  vec4 blendDifference(vec4 base, vec4 top) {
    return vec4(abs(base.rgb - top.rgb), top.a);
  }

  vec4 blendExclusion(vec4 base, vec4 top) {
    return vec4(base.rgb + top.rgb - 2.0 * base.rgb * top.rgb, top.a);
  }

  vec4 blendHue(vec4 base, vec4 top) {
    vec3 baseHSL = rgb2hsl(base.rgb);
    vec3 topHSL = rgb2hsl(top.rgb);
    vec3 result = hsl2rgb(vec3(topHSL.x, baseHSL.y, baseHSL.z));
    return vec4(result, top.a);
  }

  vec4 blendSaturation(vec4 base, vec4 top) {
    vec3 baseHSL = rgb2hsl(base.rgb);
    vec3 topHSL = rgb2hsl(top.rgb);
    vec3 result = hsl2rgb(vec3(baseHSL.x, topHSL.y, baseHSL.z));
    return vec4(result, top.a);
  }

  vec4 blendColor(vec4 base, vec4 top) {
    vec3 baseHSL = rgb2hsl(base.rgb);
    vec3 topHSL = rgb2hsl(top.rgb);
    vec3 result = hsl2rgb(vec3(topHSL.x, topHSL.y, baseHSL.z));
    return vec4(result, top.a);
  }

  vec4 blendLuminosity(vec4 base, vec4 top) {
    vec3 baseHSL = rgb2hsl(base.rgb);
    vec3 topHSL = rgb2hsl(top.rgb);
    vec3 result = hsl2rgb(vec3(baseHSL.x, baseHSL.y, topHSL.z));
    return vec4(result, top.a);
  }

  vec4 applyBlendMode(vec4 base, vec4 top, int blendMode) {
    if (blendMode == 0) return blendNormal(base, top);
    if (blendMode == 1) return blendMultiply(base, top);
    if (blendMode == 2) return blendScreen(base, top);
    if (blendMode == 3) return blendOverlay(base, top);
    if (blendMode == 4) return blendSoftLight(base, top);
    if (blendMode == 5) return blendHardLight(base, top);
    if (blendMode == 6) return blendColorDodge(base, top);
    if (blendMode == 7) return blendColorBurn(base, top);
    if (blendMode == 8) return blendDarken(base, top);
    if (blendMode == 9) return blendLighten(base, top);
    if (blendMode == 10) return blendDifference(base, top);
    if (blendMode == 11) return blendExclusion(base, top);
    if (blendMode == 12) return blendHue(base, top);
    if (blendMode == 13) return blendSaturation(base, top);
    if (blendMode == 14) return blendColor(base, top);
    if (blendMode == 15) return blendLuminosity(base, top);
    return blendNormal(base, top);
  }
` 