// KF-MIGRATE: Replace legacy static tool defaults with Track seeds at t=0. All parameters migrate to Track<Keyframe<T>> sampled at playheadTime.
// KF-MIGRATE: TOOL_VALUES.defaultValue is only used to seed first keyframe at t=0; no runtime static fallback.
export type ToolValueStepType = {
  min: number
  max: number
  step: number
  defaultValue: number
}
export type ToolValueBooleanType = {
  defaultValue: boolean
}
export type ToolValueNumberType = {
  defaultValue: number
}
export type ToolValueStringType = {
  defaultValue: string
}
export type ToolValueDimensionType = {
  width: number
  height: number
  x: number
  y: number
  defaultValue: {
    width: number
    height: number
    x: number
    y: number
  }
}
export type ToolValueCropType = CropToolsType["crop"] & {
  defaultValue: CropToolsType["crop"]
}

export type ToolValueColorType = {
  min: number
  max: number
  step: number
  defaultValue: {
    value: number
    color: string
  }
}

export type ToolValueTypes =
  | ToolValueStepType
  | ToolValueBooleanType
  | ToolValueNumberType
  | ToolValueDimensionType
  | ToolValueCropType
  | ToolValueColorType
  | ToolValueStringType

export type ToolValueKeys =
  | AdjustmentType
  | RotateType
  | DimensionsType
  | CropType
  | ScaleType
  | UpscaleType

export const TOOL_VALUES: Record<ToolValueKeys, ToolValueTypes> = {
  // KF-MIGRATE: This table is a schema for ranges/constraints only. defaultValue seeds the t=0 keyframe during track creation.
  // Adjustment values
  brightness: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
  contrast: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
  saturation: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
  exposure: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  hue: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 180,
  },
  temperature: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  gamma: {
    min: 0.1,
    max: 3.0,
    step: 0.01,
    defaultValue: 1,
  },
  grayscale: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 100,
  },
  vibrance: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 0,
  },
  solid: {
    defaultValue: "#000000",
  },
  invert: {
    defaultValue: 100,
  },
  colorizeHue: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 180,
  },
  colorizeSaturation: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
  },
  colorizeLightness: {
    min: -100,
    max: 200,
    step: 1,
    defaultValue: 50,
  },
  colorizeAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
  },
  colorizePreserveLum: {
    defaultValue: false,
  },
  sepia: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  vintage: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },

  // Effect values
  sharpenAmount: {
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 0,
  },
  sharpenRadius: {
    min: 0.1,
    max: 10,
    step: 0.1,
    defaultValue: 1.5,
  },
  sharpenThreshold: {
    min: 0,
    max: 255,
    step: 1,
    defaultValue: 0,
  },
  noiseAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  noiseSize: {
    min: 0.1,
    max: 5.0,
    step: 0.1,
    defaultValue: 1.0,
  },
  gaussianAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  gaussianRadius: {
    min: 0.1,
    max: 10.0,
    step: 0.1,
    defaultValue: 1.0,
  },
  tint: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },

  // Tool values

  rotate: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 0,
  },
  scale: {
    min: 0.01,
    max: 100,
    step: 0.01,
    defaultValue: 1,
  },
  flipVertical: {
    defaultValue: 0,
  },
  flipHorizontal: {
    defaultValue: 0,
  },
  zoom: {
    defaultValue: 50,
  },
  upscale: {
    defaultValue: 0,
  },
  dimensions: {
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    defaultValue: {
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    },
  },
  crop: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    overlay: "thirdGrid",
    defaultValue: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      overlay: "thirdGrid",
    },
  },
}

export type DimensionsToolsType = {
  dimensions: {
    width: number
    height: number
    x: number
    y: number
  }
  zoom: number
}

export type RotateToolsType = {
  rotate: number
  scale: number
  flipVertical: boolean
  flipHorizontal: boolean
}

export type CropToolsType = {
  crop: {
    x: number
    y: number
    width: number
    height: number
    overlay: "thirdGrid" | "goldenSpiral" | "grid" | "diagonals"
  }
}

export type ScaleToolsType = {
  scale: number
}

export type UpscaleToolsType = {
  upscale: number
}

export type AdjustLayersType = {
  brightness: number
  contrast: number
  exposure: number
  gamma: number
  grayscale: number
  hue: number
  invert: number
  saturation: number
  solid: string
  vintage: number
  temperature: number
  tint: number
  colorizeHue: number
  colorizeSaturation: number
  colorizeLightness: number
  colorizePreserveLum: boolean
  colorizeAmount: number
  vibrance: number
  sharpenAmount: number
  sharpenRadius: number
  sharpenThreshold: number
  noiseAmount: number
  noiseSize: number
  gaussianAmount: number
  gaussianRadius: number
  sepia: number
}

export type AdjustmentType = keyof AdjustLayersType
export type RotateType = keyof RotateToolsType
export type DimensionsType = keyof DimensionsToolsType
export type CropType = keyof CropToolsType
export type ScaleType = keyof ScaleToolsType
export type UpscaleType = keyof UpscaleToolsType

// Keyframe/Track scaffolding
export type EasingKind =
  | "linear"
  | "stepped"
  | "easeIn"
  | "easeOut"
  | "easeInOut"

export type Keyframe<T extends number | boolean | string = number> = {
  t: number // seconds
  v: T
  easing?: EasingKind
}

export type Track<T extends number | boolean | string = number> = {
  id: string
  param: string
  kfs: Keyframe<T>[]
  stepped?: boolean
}

export function sampleTrack<T extends number | boolean | string = number>(
  track: Track<T>,
  t: number
): T {
  const kfs = track.kfs
  if (!kfs || kfs.length === 0) {
    // @ts-expect-error caller must seed tracks at creation
    return 0
  }
  if (kfs.length === 1) return kfs[0].v
  // find bracketing keyframes
  let left = kfs[0]
  let right = kfs[kfs.length - 1]
  if (t <= left.t) return left.v
  if (t >= right.t) return right.v
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]
    const b = kfs[i + 1]
    if (t >= a.t && t <= b.t) {
      left = a
      right = b
      break
    }
  }
  // stepped/discrete
  const stepped =
    track.stepped || left.easing === "stepped" || right.easing === "stepped"
  if (stepped) return left.v
  const dt = right.t - left.t
  const u = dt <= 0 ? 0 : (t - left.t) / dt
  const ease = (kind?: EasingKind, x?: number) => {
    const s = Math.max(0, Math.min(1, x ?? 0))
    switch (kind) {
      case "easeIn":
        return s * s
      case "easeOut":
        return 1 - (1 - s) * (1 - s)
      case "easeInOut":
        return s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2
      default:
        return s
    }
  }
  const w = ease(left.easing || right.easing || "linear", u)
  // @ts-expect-error boolean/string tracks should be stepped; numeric assumed here
  return (left.v as number) * (1 - w) + (right.v as number) * w
}

export function addOrUpdateKeyframe<
  T extends number | boolean | string = number,
>(track: Track<T>, t: number, v: T, easing?: EasingKind): Track<T> {
  const kfs = [...track.kfs]
  const idx = kfs.findIndex((k) => k.t === t)
  if (idx >= 0) {
    kfs[idx] = { t, v, easing: easing ?? kfs[idx].easing }
  } else {
    kfs.push({ t, v, easing })
    kfs.sort((a, b) => a.t - b.t)
  }
  return { ...track, kfs }
}

export function removeKeyframe<T extends number | boolean | string = number>(
  track: Track<T>,
  t: number
): Track<T> {
  const kfs = track.kfs.filter((k) => k.t !== t)
  return { ...track, kfs }
}
