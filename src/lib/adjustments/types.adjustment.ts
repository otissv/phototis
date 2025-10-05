export type AdjustmentTypes =
  // current
  | "brightness"
  | "contrast"
  | "exposure"
  | "gamma"
  | "hue"
  | "saturation"
  | "temperature"
  | "colorize"
  | "vibrance"
  | "vintage"
  | "grayscale"
  | "invert"
  | "sepia"
  | "sharpen"
  | "gaussian"
  | "noise"
  | "grain"
  | "solid"

  // tier 1 (core / must-have)
  | "levels" // black/white input-output, gamma
  | "curves" // tonal curves, per-channel
  | "hsl" // hue/sat/lum per hue range
  | "shadows-highlights" // recover tones
  | "color-balance" // adjust shadows/mids/highlights
  | "color-wheels" // lift-gamma-gain grading
  | "lut" // color lookup (.cube, .3dl)
  | "tint" // green-magenta balance
  | "whites" // white point slider
  | "blacks" // black point slider

  // tier 2 (pro / strong enhancers)
  | "channel-mixer" // per-channel mixing, monochrome option
  | "gradient-map" // map luminance → gradient
  | "selective-color" // adjust per-color family (CMYK-like)
  | "clarity" // midtone contrast
  | "texture" // micro-detail
  | "dehaze" // haze/atmospheric correction
  | "vignette" // post-crop vignette
  | "split-toning" // legacy duotone coloring

  // tier 3 (creative & utility)
  | "posterize" // reduce tonal steps
  | "threshold" // binary mask by luminance
  | "solarize" // photo-solarization effect
  | "high-pass" // high-pass sharpen
  | "unsharp-mask" // unsharp sharpening
  | "noise-reduction" // chroma/luma smoothing
  | "defringe" // edge CA cleanup
  | "chromatic-aberration" // CA correction (lens)

/* eslint-disable @typescript-eslint/consistent-type-definitions */
/**
 * Adjustment parameters schema (production-ready)
 * - Strict discriminated unions for every adjustment
 * - Full, descriptive key names (no abbreviations)
 * - Designed for per-field animation and schema evolution
 */

export type RgbaColor = {
  /** 0–1 linear/sRGB normalized channels */
  red: number
  green: number
  blue: number
  /** 0–1; default 1 if omitted */
  alpha?: number
}

export type CurvePoint = {
  /** 0–1, input domain */
  input: number
  /** 0–1, output range */
  output: number
}

export type ToneCurve = {
  /** Master (composite) curve; empty = identity */
  composite: CurvePoint[]
  /** Per-channel (optional); empty = identity */
  red?: CurvePoint[]
  green?: CurvePoint[]
  blue?: CurvePoint[]
}

/** Eight common color bands used by HSL/Color Mixers */
export type HslColorBandName =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "aqua"
  | "blue"
  | "purple"
  | "magenta"

export type HslBandControls = {
  /** -100..+100 (° remapped), default 0 */
  hueShift: number
  /** -100..+100 (%), default 0 */
  saturation: number
  /** -100..+100 (%), default 0 */
  luminance: number
}

export type ChannelMixerOutput = {
  /** -200..+200 (% contribution), default 100 for own channel */
  redFromRed: number
  redFromGreen: number
  redFromBlue: number

  greenFromRed: number
  greenFromGreen: number
  greenFromBlue: number

  blueFromRed: number
  blueFromGreen: number
  blueFromBlue: number

  /** Optional overall constant offset per channel (-100..+100 %) */
  redConstant?: number
  greenConstant?: number
  blueConstant?: number

  /** Convert to monochrome using channel weights (if true, uses redFrom*, greenFrom*, blueFrom* as weights) */
  convertToMonochrome?: boolean
}

export type SelectiveColorFamily =
  | "reds"
  | "yellows"
  | "greens"
  | "cyans"
  | "blues"
  | "magentas"
  | "whites"
  | "neutrals"
  | "blacks"

export type SelectiveColorControls = {
  /** -100..+100 (%) */
  cyan: number
  /** -100..+100 (%) */
  magenta: number
  /** -100..+100 (%) */
  yellow: number
  /** -100..+100 (%) */
  black: number
}

// ——— Tonal (single-parameter basics) ———
export type BrightnessParametersAdjustmentType = {
  type: "brightness"
  brightness: number
} // -100..+100 %
export type ExposureParametersAdjustmentType = {
  type: "exposure"
  exposureStops: number
} // -5..+5 EV
export type ContrastParametersAdjustmentType = {
  type: "contrast"
  contrast: number
} // -100..+100 %
export type GammaParametersAdjustmentType = { type: "gamma"; gamma: number } // 0.1..5.0
export type WhitesParametersAdjustmentType = {
  type: "whites"
  whitePoint: number
} // -100..+100 %
export type BlacksParametersAdjustmentType = {
  type: "blacks"
  blackPoint: number
} // -100..+100 %
export type LevelsParametersAdjustmentType = {
  type: "levels"
  /** 0..255 */
  inputBlackPoint: number
  /** 0..255 */
  inputWhitePoint: number
  /** 0.1..5.0 */
  inputGamma: number
  /** 0..255 */
  outputBlackPoint: number
  /** 0..255 */
  outputWhitePoint: number
}
export type CurvesParametersAdjustmentType = {
  type: "curves"
  toneCurve: ToneCurve
}
export type ShadowsHighlightsParametersAdjustmentType = {
  type: "shadowsHighlights"
  /** 0..100 (%) */
  shadowsAmount: number
  /** 0..100 (%) */
  highlightsAmount: number
  /** 1..200 (px) soft radius for masks */
  radiusPixels: number
  /** 0..100 (%) tone width balance */
  toneWidth: number
}
export type HueParametersAdjustmentType = {
  type: "hue"
  hueShiftDegrees: number
} // -180..+180
export type SaturationParametersAdjustmentType = {
  type: "saturation"
  saturation: number
} // -100..+100 %
export type VibranceParametersAdjustmentType = {
  type: "vibrance"
  vibrance: number
} // -100..+100 %
export type WhiteBalanceParametersAdjustmentType = {
  type: "whiteBalance"
  /** -100 cool .. +100 warm */
  temperatureShift: number
  /** -100 green .. +100 magenta */
  tintShift: number
}
export type ColorBalanceParametersAdjustmentType = {
  type: "colorBalance"
  shadows: { redCyan: number; greenMagenta: number; blueYellow: number } // each -100..+100
  midtones: { redCyan: number; greenMagenta: number; blueYellow: number }
  highlights: { redCyan: number; greenMagenta: number; blueYellow: number }
  /** Preserve luminosity toggle */
  preserveLuminosity?: boolean
}
export type ColorWheelsParametersAdjustmentType = {
  type: "colorWheels"
  lift: { hueDegrees: number; saturation: number; intensity: number } // sat/intensity 0..1
  gamma: { hueDegrees: number; saturation: number; intensity: number }
  gain: { hueDegrees: number; saturation: number; intensity: number }
  global?: { hueDegrees: number; saturation: number; intensity: number }
}
export type HslColorMixerParametersAdjustmentType = {
  type: "hslColorMixer"
  bands: Record<HslColorBandName, HslBandControls>
}
export type ChannelMixerParametersAdjustmentType = {
  type: "channelMixer"
  output: ChannelMixerOutput
}
export type SelectiveColorParametersAdjustmentType = {
  type: "selectiveColor"
  /** “Relative” (default) or “Absolute” mode affects math; included as a flag */
  useAbsoluteAdjustment?: boolean
  families: Record<SelectiveColorFamily, SelectiveColorControls>
}
export type RecolorParametersAdjustmentType = {
  type: "colorize"
  targetColor: RgbaColor
  intensity: number
}
export type GradientMapParametersAdjustmentType = {
  type: "gradientMap"
  /** Ordered stops across 0..1 luminance; at least 2 stops */
  colorStops: { position: number; color: RgbaColor }[]
  intensity: number // 0..1
}
export type ColorLookupTableParametersAdjustmentType = {
  type: "colorLookupTable"
  /** Reference to installed LUT asset (hash, id or URL) */
  lookupTableId: string
  /** 0..1 mix amount */
  intensity: number
}
export type SepiaToneParametersAdjustmentType = {
  type: "sepiaTone"
  intensity: number
} // 0..1
export type GrayscaleParametersAdjustmentType = {
  type: "grayscale"
  intensity: number
} // 0..1
export type InvertParametersAdjustmentType = {
  type: "invert"
  enabled: boolean
} // simple toggle
export type VintageLookParametersAdjustmentType = {
  type: "vintageLook"
  strength: number
} // 0..1
export type PosterizeParametersAdjustmentType = {
  type: "posterize"
  levels: number
} // 2..255
export type ThresholdParametersAdjustmentType = {
  type: "threshold"
  thresholdLevel: number
} // 0..255
export type SolarizeParametersAdjustmentType = {
  type: "solarize"
  intensity: number
} // 0..1
export type SplitToningParametersAdjustmentType = {
  type: "splitToning"
  highlightsColor: RgbaColor
  shadowsColor: RgbaColor
  /** -100..+100; positive favors highlights */
  balance: number
}
export type ClarityParametersAdjustmentType = {
  type: "clarity"
  clarity: number
} // -100..+100
export type TextureParametersAdjustmentType = {
  type: "texture"
  texture: number
} // -100..+100
export type DehazeParametersAdjustmentType = { type: "dehaze"; dehaze: number } // -100..+100
export type UnsharpMaskParametersAdjustmentType = {
  type: "unsharpMask"
  /** 0..5 (multiplier) */
  amount: number
  /** 0.1..250 (px) */
  radiusPixels: number
  /** 0..255 */
  thresholdLevel: number
}
export type HighPassSharpenParametersAdjustmentType = {
  type: "highPassSharpen"
  radiusPixels: number
} // 0.1..250
export type SharpenSimpleParametersAdjustmentType = {
  type: "sharpenSimple"
  amount: number
} // 0..1 (fallback simple sharpen)
export type GaussianBlurParametersAdjustmentType = {
  type: "gaussianBlur"
  radiusPixels: number
} // 0..250
export type FilmGrainParametersAdjustmentType = {
  type: "filmGrain"
  amount: number
  size: number
} // amount 0..1, size 0..1
export type AdditiveNoiseParametersAdjustmentType = {
  type: "additiveNoise"
  amount: number
  monochrome?: boolean
} // amount 0..1
export type NoiseReductionParametersAdjustmentType = {
  type: "noiseReduction"
  luminanceDenoise: number // 0..1
  luminanceDetail: number // 0..1
  luminanceContrast: number // 0..1
  colorDenoise: number // 0..1
  colorDetail: number // 0..1
}
export type DefringeParametersAdjustmentType = {
  type: "defringe"
  /** 0..1 */
  amount: number
  /** Optional color range tuning (0..1); leave undefined for auto */
  purpleHueStart?: number
  purpleHueEnd?: number
  greenHueStart?: number
  greenHueEnd?: number
}
export type ChromaticAberrationCorrectionParametersAdjustmentType = {
  type: "chromaticAberrationCorrection"
  /** -100..+100 (pixels or normalized shift depending on implementation) */
  redCyanShift: number
  /** -100..+100 */
  blueYellowShift: number
}
export type VignetteParametersAdjustmentType = {
  type: "vignette"
  /** -100 (darken) .. +100 (lighten) */
  amount: number
  /** 0..100 */
  midpoint: number
  /** -100..+100 */
  roundness: number
  /** 0..100 */
  feather: number
  /** Apply post-crop (true) or pre-crop (false) */
  applyAfterCrop?: boolean
}

export type AdjustmentParameters =
  // ——— Tonal (single-parameter basics) ———
  | BrightnessParametersAdjustmentType
  | ExposureParametersAdjustmentType
  | ContrastParametersAdjustmentType
  | GammaParametersAdjustmentType
  | WhitesParametersAdjustmentType
  | BlacksParametersAdjustmentType

  // ——— Levels ———
  | LevelsParametersAdjustmentType

  // ——— Curves ———
  | CurvesParametersAdjustmentType

  // ——— Shadows / Highlights ———
  | ShadowsHighlightsParametersAdjustmentType

  // ——— Color basics ———
  | HueParametersAdjustmentType
  | SaturationParametersAdjustmentType
  | VibranceParametersAdjustmentType
  | WhiteBalanceParametersAdjustmentType

  // ——— Color Balance (3 ranges × 3 axes) ———
  | ColorBalanceParametersAdjustmentType

  // ——— Color Wheels (Lift / Gamma / Gain) ———
  | ColorWheelsParametersAdjustmentType

  // ——— HSL / Color Mixer ———
  | HslColorMixerParametersAdjustmentType

  // ——— Channel Mixer ———
  | ChannelMixerParametersAdjustmentType

  // ——— Selective Color ———
  | SelectiveColorParametersAdjustmentType

  // ——— Colorize / Gradient Map / LUT ———
  | RecolorParametersAdjustmentType
  | GradientMapParametersAdjustmentType
  | ColorLookupTableParametersAdjustmentType

  // ——— Creative Looks ———
  | SepiaToneParametersAdjustmentType
  | GrayscaleParametersAdjustmentType
  | InvertParametersAdjustmentType
  | VintageLookParametersAdjustmentType
  | PosterizeParametersAdjustmentType
  | ThresholdParametersAdjustmentType
  | SolarizeParametersAdjustmentType
  | SplitToningParametersAdjustmentType

  // ——— Detail / Texture ———
  | ClarityParametersAdjustmentType
  | TextureParametersAdjustmentType
  | DehazeParametersAdjustmentType

  // ——— Sharpening ———
  | UnsharpMaskParametersAdjustmentType
  | HighPassSharpenParametersAdjustmentType
  | SharpenSimpleParametersAdjustmentType

  // ——— Blur / Grain / Noise ———
  | GaussianBlurParametersAdjustmentType
  | FilmGrainParametersAdjustmentType
  | AdditiveNoiseParametersAdjustmentType

  // ——— Noise Reduction ———
  | NoiseReductionParametersAdjustmentType
  | DefringeParametersAdjustmentType
  | ChromaticAberrationCorrectionParametersAdjustmentType

  // ——— Vignette ———
  | VignetteParametersAdjustmentType
