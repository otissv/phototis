import {
  TOOL_VALUES,
  type ToolValueBooleanType,
  type ToolValueDimensionType,
  type ToolValueStepType,
} from "@/constants"

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

export type ImageEditorToolsActions =
  | ImageEditorToolsAction
  | ImageEditorToolsResetAction
  | ImageEditorToolsHistoryAction

export type HistoryToolsState = {
  history: ImageEditorToolsAction[]
  currentIndex: number
}

export type TransformToolsState = {
  rotate: number
  scale: number
  flipVertical: boolean
  flipHorizontal: boolean
}

export type FinetuneToolsState = {
  blur: number
  blurType: number
  blurDirection: number
  blurCenter: number
  brightness: number
  contrast: number
  exposure: number
  gamma: number
  grain: number
  grayscale: number
  hue: number
  invert: number
  noise: number
  saturation: number
  sepia: number
  sharpen: number
  temperature: number
  tint: number
  vibrance: number
  vintage: number
}

export type ImageEditorToolsState = TransformToolsState &
  FinetuneToolsState &
  HistoryToolsState & {
    zoom: number
    upscale: number
    resize: {
      width: number
      height: number
    }
  }

export const initialState: ImageEditorToolsState = {
  history: [],
  currentIndex: 0,
  rotate: TOOL_VALUES.rotate.defaultValue as ToolValueStepType["defaultValue"],
  scale: TOOL_VALUES.scale.defaultValue as ToolValueStepType["defaultValue"],
  flipVertical: TOOL_VALUES.flipVertical
    .defaultValue as ToolValueBooleanType["defaultValue"],
  flipHorizontal: TOOL_VALUES.flipHorizontal
    .defaultValue as ToolValueBooleanType["defaultValue"],
  brightness: TOOL_VALUES.brightness
    .defaultValue as ToolValueStepType["defaultValue"],
  contrast: TOOL_VALUES.contrast
    .defaultValue as ToolValueStepType["defaultValue"],
  hue: TOOL_VALUES.hue.defaultValue as ToolValueStepType["defaultValue"],
  saturation: TOOL_VALUES.saturation
    .defaultValue as ToolValueStepType["defaultValue"],
  exposure: TOOL_VALUES.exposure
    .defaultValue as ToolValueStepType["defaultValue"],
  temperature: TOOL_VALUES.temperature
    .defaultValue as ToolValueStepType["defaultValue"],
  gamma: TOOL_VALUES.gamma.defaultValue as ToolValueStepType["defaultValue"],
  vintage: TOOL_VALUES.vintage
    .defaultValue as ToolValueStepType["defaultValue"],
  blur: TOOL_VALUES.blur.defaultValue as ToolValueStepType["defaultValue"],
  blurType: TOOL_VALUES.blurType
    .defaultValue as ToolValueStepType["defaultValue"],
  blurDirection: TOOL_VALUES.blurDirection
    .defaultValue as ToolValueStepType["defaultValue"],
  blurCenter: TOOL_VALUES.blurCenter
    .defaultValue as ToolValueStepType["defaultValue"],
  invert: TOOL_VALUES.invert.defaultValue as ToolValueStepType["defaultValue"],
  sepia: TOOL_VALUES.sepia.defaultValue as ToolValueStepType["defaultValue"],
  grayscale: TOOL_VALUES.grayscale
    .defaultValue as ToolValueStepType["defaultValue"],
  sharpen: TOOL_VALUES.sharpen
    .defaultValue as ToolValueStepType["defaultValue"],
  tint: TOOL_VALUES.tint.defaultValue as ToolValueStepType["defaultValue"],
  vibrance: TOOL_VALUES.vibrance
    .defaultValue as ToolValueStepType["defaultValue"],
  noise: TOOL_VALUES.noise.defaultValue as ToolValueStepType["defaultValue"],
  grain: TOOL_VALUES.grain.defaultValue as ToolValueStepType["defaultValue"],
  zoom: TOOL_VALUES.zoom.defaultValue as ToolValueStepType["defaultValue"],
  upscale: TOOL_VALUES.upscale
    .defaultValue as ToolValueStepType["defaultValue"],
  resize: TOOL_VALUES.resize
    .defaultValue as ToolValueDimensionType["defaultValue"],
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

  if (action.type === "undo") {
    return {
      ...state,
      history: state.history.slice(0, state.currentIndex),
      currentIndex: state.currentIndex - 1,
    }
  }

  if (action.type === "redo") {
    return {
      ...state,
      history: state.history.slice(0, state.currentIndex + 1),
      currentIndex: state.currentIndex + 1,
    }
  }

  const nextState = {
    ...state,
    history: [...state.history, action],
    currentIndex: state.currentIndex + 1,
  }

  return {
    ...nextState,
    [action.type]: (action as ImageEditorToolsAction).payload,
  } as ImageEditorToolsState
}
