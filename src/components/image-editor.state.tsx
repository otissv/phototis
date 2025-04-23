import { TOOL_VALUES } from "@/constants"

export type ImageEditorToolsAction = {
  type: keyof typeof TOOL_VALUES | "reset"
  payload: number
}

export type ImageEditorToolsResetAction = {
  type: "reset"
}

export type ImageEditorToolsActions =
  | ImageEditorToolsAction
  | ImageEditorToolsResetAction

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
  }

export const initialState: ImageEditorToolsState = {
  history: [],
  currentIndex: 0,
  rotate: TOOL_VALUES.rotate.defaultValue,
  scale: TOOL_VALUES.scale.defaultValue,
  flipVertical: false,
  flipHorizontal: false,
  brightness: TOOL_VALUES.brightness.defaultValue,
  contrast: TOOL_VALUES.contrast.defaultValue,
  hue: TOOL_VALUES.hue.defaultValue,
  saturation: TOOL_VALUES.saturation.defaultValue,
  exposure: TOOL_VALUES.exposure.defaultValue,
  temperature: TOOL_VALUES.temperature.defaultValue,
  gamma: TOOL_VALUES.gamma.defaultValue,
  vintage: TOOL_VALUES.vintage.defaultValue,
  blur: TOOL_VALUES.blur.defaultValue,
  invert: TOOL_VALUES.invert.defaultValue,
  sepia: TOOL_VALUES.sepia.defaultValue,
  grayscale: TOOL_VALUES.grayscale.defaultValue,
  sharpen: TOOL_VALUES.sharpen.defaultValue,
  tint: TOOL_VALUES.tint.defaultValue,
  vibrance: TOOL_VALUES.vibrance.defaultValue,
  noise: TOOL_VALUES.noise.defaultValue,
  grain: TOOL_VALUES.grain.defaultValue,
  zoom: 50,
}

export function imageEditorToolsReducer(
  state: ImageEditorToolsState,
  action: ImageEditorToolsActions
): ImageEditorToolsState {
  if (action.type === "reset") {
    return initialState
  }

  const nextState = {
    ...state,
    history: [...state.history, action],
    currentIndex: state.currentIndex + 1,
  }

  return {
    ...nextState,
    [action.type]: action.payload,
  }
}
