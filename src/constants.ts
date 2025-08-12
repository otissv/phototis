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

export type ToolValueTypes =
  | ToolValueStepType
  | ToolValueBooleanType
  | ToolValueNumberType
  | ToolValueDimensionType
  | ToolValueCropType

type ToolValueKeys =
  | "brightness"
  | "contrast"
  | "saturation"
  | "exposure"
  | "hue"
  | "temperature"
  | "gamma"
  | "vintage"
  | "blur"
  | "blurType"
  | "blurDirection"
  | "blurCenter"
  | "sharpen"
  | "invert"
  | "sepia"
  | "grayscale"
  | "tint"
  | "vibrance"
  | "noise"
  | "grain"
  | "rotate"
  | "scale"
  | "flipVertical"
  | "flipHorizontal"
  | "zoom"
  | "upscale"
  | "resize"
  | "crop"

export const TOOL_VALUES: Record<ToolValueKeys, ToolValueTypes> = {
  brightness: {
    min: 1,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
  contrast: {
    min: 1,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
  saturation: {
    min: 1,
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
    min: 0.1,
    max: 3.0,
    step: 0.01,
    defaultValue: 1,
  },
  vintage: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
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
  invert: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  sepia: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  grayscale: {
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
  vibrance: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
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
    defaultValue: false,
  },
  flipHorizontal: {
    defaultValue: false,
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

export const SIDEBAR_TOOLS = {
  rotate: ["rotate", "flipVertical", "flipHorizontal"],
  resize: ["scale", "resize", "upscale", "crop"],
  actions: ["actions"],
  layers: ["layers"],
  adjust: [
    "brightness",
    "contrast",
    "exposure",
    "gamma",
    "hue",
    "saturation",
    "temperature",
    "tint",
    "vibrance",
    "vintage",
  ],
  effects: [
    "blur",
    "grain",
    "grayscale",
    "invert",
    "noise",
    "sepia",
    "sharpen",
  ],
}
