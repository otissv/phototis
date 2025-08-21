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
  defaultValue: {
    width: number
    height: number
  }
}
export type ToolValueCropType = {
  x: number
  y: number
  width: number
  height: number
  defaultValue: {
    x: number
    y: number
    width: number
    height: number
  }
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
  | FilterType
  | RotateType
  | ResizeType

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
    min: -180,
    max: 180,
    step: 1,
    defaultValue: 0,
  },
  temperature: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  gamma: {
    min: 0,
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
    defaultValue: 0,
  },
  tint: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: {
      value: 0,
      color: "#000000",
    },
  },
  // Filter values
  blur: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 0,
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

  // Filter values

  noise: {
    min: 0,
    max: 50,
    step: 1,
    defaultValue: 0,
  },
  grain: {
    min: 0,
    max: 50,
    step: 1,
    defaultValue: 0,
  },
  sharpen: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  rotate: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 0,
  },
  scale: {
    min: 1,
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
  resize: {
    width: 0,
    height: 0,
    defaultValue: {
      width: 0,
      height: 0,
    },
  },
  crop: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    defaultValue: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
  },
}

export type ResizeToolsType = {
  scale: number
  resize: {
    width: number
    height: number
  }
  upscale: number
  crop: {
    x: number
    y: number
    width: number
    height: number
  }
  zoom: number
}

export type RotateToolsType = {
  rotate: number
  scale: number
  flipVertical: boolean
  flipHorizontal: boolean
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
  tint: {
    value: number
    color: string
  }
  vibrance: number
}

export type FilterToolsType = {
  blur: number
  blurCenter: number
  blurDirection: number
  blurType: number
  grain: number
  noise: number
  sepia: number
  sharpen: number
}

export type AdjustmentType = keyof AdjustLayersType
export type FilterType = keyof FilterToolsType
export type RotateType = keyof RotateToolsType
export type ResizeType = keyof ResizeToolsType
