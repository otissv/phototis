import {
  TOOL_VALUES,
  type ToolValueCropType,
  type AdjustLayersType,
  type FilterToolsType,
  type ResizeToolsType,
  type RotateToolsType,
  type ToolValueBooleanType,
  type ToolValueColorType,
  type ToolValueDimensionType,
  type ToolValueStepType,
  type ToolValueStringType,
} from "@/lib/tools"

export type ImageEditorToolsState = AdjustLayersType &
  FilterToolsType &
  HistoryToolsState &
  ResizeToolsType &
  RotateToolsType

export const SIDEBAR_TOOLS = {
  effects: ["blur", "grain", "noise", "sharpen"],
  presets: ["presets"],
  resize: ["scale", "resize", "upscale", "crop"],
  rotate: ["rotate", "flipVertical", "flipHorizontal"],
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
  solid: TOOL_VALUES.solid.defaultValue as ToolValueStringType["defaultValue"],
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
