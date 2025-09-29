// Color space conversions and clamping utilities

export type RGBA = [number, number, number, number]

// sRGB -> Linear (per component)
export function srgbToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92
  return Math.pow((c + 0.055) / 1.055, 2.4)
}

// Linear -> sRGB (per component)
export function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

// Convert RGBA sRGB [0..1] to linear floats [0..1]
export function srgbRgbaToLinear(rgba: RGBA): RGBA {
  return [
    clamp01(srgbToLinear(rgba[0])),
    clamp01(srgbToLinear(rgba[1])),
    clamp01(srgbToLinear(rgba[2])),
    clamp01(rgba[3]),
  ]
}

// Convert RGBA linear [0..1] to sRGB [0..1]
export function linearRgbaToSrgb(rgba: RGBA): RGBA {
  return [
    clamp01(linearToSrgb(rgba[0])),
    clamp01(linearToSrgb(rgba[1])),
    clamp01(linearToSrgb(rgba[2])),
    clamp01(rgba[3]),
  ]
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}
