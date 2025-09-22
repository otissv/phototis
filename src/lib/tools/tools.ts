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
  | DimensionsCanvasType
  | EffectsType
  | MoveType
  | CropType
  | ScaleType
  | UpscaleType

export const TOOL_VALUES: Record<ToolValueKeys, ToolValueTypes> = {
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
  blurType: {
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 0,
  },
  blurDirection: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 0,
  },
  blurCenter: {
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.5,
  },
  grain: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
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
  move: {
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

export type DimensionsCanvasToolsType = {
  dimensionsCanvas: {
    width: number
    height: number
    x: number
    y: number
  }
}

export type EffectsToolsType = {
  blur: number
  blurType: number
  blurDirection: number
  blurCenter: number
  noise: number
  grain: number
  sharpen: number
  sepia: number
}

export type MoveToolsType = {
  move: {
    width: number
    height: number
    x: number
    y: number
  }
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
export type DimensionsCanvasType = keyof DimensionsCanvasToolsType
export type EffectsType = keyof EffectsToolsType
export type MoveType = keyof MoveToolsType
