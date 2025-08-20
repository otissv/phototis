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

type ToolValueKeys = AdjustmentType | FilterType | RotateType | ResizeType

export type ResizeToolsState = {
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

export type RotateToolsState = {
  rotate: number
  scale: number
  flipVertical: boolean
  flipHorizontal: boolean
}

export type AdjustLayersState = {
  brightness: number
  contrast: number
  exposure: number
  gamma: number
  grayscale: number
  hue: number
  invert: number
  saturation: number
  solid: {
    value: number
    color: string
  }
  vintage: number
  temperature: number
  tint: {
    value: number
    color: string
  }
  vibrance: number
}

export type FilterToolsState = {
  blur: number
  blurCenter: number
  blurDirection: number
  blurType: number
  grain: number
  noise: number
  sepia: number
  sharpen: number
}

export type AdjustmentType = keyof AdjustLayersState
export type FilterType = keyof FilterToolsState
export type RotateType = keyof RotateToolsState
export type ResizeType = keyof ResizeToolsState

export type ImageEditorToolsState = AdjustLayersState &
  FilterToolsState &
  HistoryToolsState &
  ResizeToolsState &
  RotateToolsState

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
    min: 0,
    max: 100,
    step: 1,
    defaultValue: {
      value: 0,
      color: "#000000",
    },
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

export const SIDEBAR_TOOLS = {
  rotate: ["rotate", "flipVertical", "flipHorizontal"],
  resize: ["scale", "resize", "upscale", "crop"],
  presets: ["presets"],
  adjust: [
    "brightness",
    "contrast",
    "exposure",
    "gamma",
    "grayscale",
    "hue",
    "invert",
    "saturation",
    "temperature",
    "tint",
    "vibrance",
    "vintage",
    "solid",
  ],
  effects: ["blur", "grain", "noise", "sepia", "sharpen"],
}
export type ImageEditorToolsAction = {
  type: keyof typeof TOOL_VALUES | "reset" | "zoom"
  payload: number
}

export type ImageEditorToolsResetAction = {
  type: "reset"
}

export type ImageEditorToolsHistoryAction = {
  type: "undo" | "redo"
}

export type ImageEditorToolsUpdateHistoryAction = {
  type: "updateHistory"
  payload: {
    type: keyof typeof TOOL_VALUES
    value: number
  }
}

export type ImageEditorToolsActions =
  | ImageEditorToolsAction
  | ImageEditorToolsResetAction
  | ImageEditorToolsHistoryAction
  | ImageEditorToolsUpdateHistoryAction
export type HistoryToolsState = {
  history: ImageEditorToolsAction[]
  historyPosition: number
}

export const initialState: ImageEditorToolsState = {
  // History values
  history: [],
  historyPosition: 0,

  // Rotate values
  flipHorizontal: TOOL_VALUES.flipHorizontal
    .defaultValue as ToolValueBooleanType["defaultValue"],
  flipVertical: TOOL_VALUES.flipVertical
    .defaultValue as ToolValueBooleanType["defaultValue"],
  rotate: TOOL_VALUES.rotate.defaultValue as ToolValueStepType["defaultValue"],

  // Resize values
  crop: TOOL_VALUES.crop.defaultValue as ToolValueCropType["defaultValue"],
  resize: TOOL_VALUES.resize
    .defaultValue as ToolValueDimensionType["defaultValue"],
  scale: TOOL_VALUES.scale.defaultValue as ToolValueStepType["defaultValue"],
  upscale: TOOL_VALUES.upscale
    .defaultValue as ToolValueStepType["defaultValue"],
  zoom: TOOL_VALUES.zoom.defaultValue as ToolValueStepType["defaultValue"],

  // Basic adjustment values
  brightness: TOOL_VALUES.brightness
    .defaultValue as ToolValueStepType["defaultValue"],
  contrast: TOOL_VALUES.contrast
    .defaultValue as ToolValueStepType["defaultValue"],
  exposure: TOOL_VALUES.exposure
    .defaultValue as ToolValueStepType["defaultValue"],
  gamma: TOOL_VALUES.gamma.defaultValue as ToolValueStepType["defaultValue"],
  grayscale: TOOL_VALUES.grayscale
    .defaultValue as ToolValueStepType["defaultValue"],
  hue: TOOL_VALUES.hue.defaultValue as ToolValueStepType["defaultValue"],
  invert: TOOL_VALUES.invert.defaultValue as ToolValueStepType["defaultValue"],
  saturation: TOOL_VALUES.saturation
    .defaultValue as ToolValueStepType["defaultValue"],
  sepia: TOOL_VALUES.sepia.defaultValue as ToolValueStepType["defaultValue"],
  solid: TOOL_VALUES.solid.defaultValue as ToolValueColorType["defaultValue"],
  temperature: TOOL_VALUES.temperature
    .defaultValue as ToolValueStepType["defaultValue"],
  tint: TOOL_VALUES.tint.defaultValue as ToolValueColorType["defaultValue"],
  vibrance: TOOL_VALUES.vibrance
    .defaultValue as ToolValueStepType["defaultValue"],
  vintage: TOOL_VALUES.vintage
    .defaultValue as ToolValueStepType["defaultValue"],

  // Effect values
  blur: TOOL_VALUES.blur.defaultValue as ToolValueStepType["defaultValue"],
  blurCenter: TOOL_VALUES.blurCenter
    .defaultValue as ToolValueStepType["defaultValue"],
  blurDirection: TOOL_VALUES.blurDirection
    .defaultValue as ToolValueStepType["defaultValue"],
  blurType: TOOL_VALUES.blurType
    .defaultValue as ToolValueStepType["defaultValue"],
  grain: TOOL_VALUES.grain.defaultValue as ToolValueStepType["defaultValue"],
  noise: TOOL_VALUES.noise.defaultValue as ToolValueStepType["defaultValue"],
  sharpen: TOOL_VALUES.sharpen
    .defaultValue as ToolValueStepType["defaultValue"],
}

export function imageEditorToolsReducer(
  state: ImageEditorToolsState,
  action: ImageEditorToolsActions
): ImageEditorToolsState {
  if (action.type === "reset") {
    return {
      ...initialState,
      zoom: state.zoom,
    }
  }

  return {
    ...state,
    [action.type]: (action as ImageEditorToolsAction).payload,
  } as ImageEditorToolsState
}
