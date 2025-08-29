import {
  TOOL_VALUES,
  type AdjustLayersType,
  type CropToolsType,
  type DimensionsToolsType,
  type FilterToolsType,
  type RotateToolsType,
  type ScaleToolsType,
  type ToolValueBooleanType,
  type ToolValueColorType,
  type ToolValueCropType,
  type ToolValueDimensionType,
  type ToolValueStepType,
  type ToolValueStringType,
  type UpscaleToolsType,
} from "@/lib/tools/tools"

export type ImageEditorToolsState = AdjustLayersType &
  FilterToolsType &
  HistoryToolsState &
  DimensionsToolsType &
  RotateToolsType &
  CropToolsType &
  ScaleToolsType &
  UpscaleToolsType

export const SIDEBAR_TOOLS = {
  effects: ["blur", "grain", "noise", "sharpen"],
  presets: ["presets"],
  scale: ["scale"],
  dimensions: ["dimensions"],
  dimensionsCanvas: ["dimensionsCanvas"],
  upscale: ["upscale"],
  crop: ["crop"],
  rotate: ["rotate", "flipVertical", "flipHorizontal"],
}
// Define payload types for non-numeric tools
type DimensionsPayload = DimensionsToolsType["dimensions"]
type CropPayload = CropToolsType["crop"]
type RecolorPayload = AdjustLayersType["recolor"]

type NumericToolKeys = Exclude<
  keyof typeof TOOL_VALUES,
  "dimensions" | "crop" | "recolor" | "solid"
>

export type NumericToolAction = {
  type: NumericToolKeys | "zoom"
  payload: number
}

export type DimensionsToolAction = {
  type: "dimensions"
  payload: DimensionsPayload
}

export type CropToolAction = {
  type: "crop"
  payload: CropPayload
}

export type RecolorToolAction = {
  type: "recolor"
  payload: RecolorPayload
}

export type SolidToolAction = {
  type: "solid"
  payload: string
}

export type ImageEditorToolsAction =
  | NumericToolAction
  | DimensionsToolAction
  | CropToolAction
  | RecolorToolAction
  | SolidToolAction

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

export const initialToolsState: ImageEditorToolsState = {
  // History values
  history: [],
  historyPosition: 0,

  // Rotate values
  flipHorizontal: TOOL_VALUES.flipHorizontal
    .defaultValue as ToolValueBooleanType["defaultValue"],
  flipVertical: TOOL_VALUES.flipVertical
    .defaultValue as ToolValueBooleanType["defaultValue"],
  rotate: TOOL_VALUES.rotate.defaultValue as ToolValueStepType["defaultValue"],

  crop: TOOL_VALUES.crop.defaultValue as ToolValueCropType["defaultValue"],

  dimensions: TOOL_VALUES.dimensions
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
  recolor: TOOL_VALUES.recolor
    .defaultValue as ToolValueColorType["defaultValue"],
  recolorHue: TOOL_VALUES.recolorHue
    .defaultValue as ToolValueStepType["defaultValue"],
  recolorSaturation: TOOL_VALUES.recolorSaturation
    .defaultValue as ToolValueStepType["defaultValue"],
  recolorLightness: TOOL_VALUES.recolorLightness
    .defaultValue as ToolValueStepType["defaultValue"],
  recolorAmount: TOOL_VALUES.recolorAmount
    .defaultValue as ToolValueStepType["defaultValue"],
  recolorPreserveLum: TOOL_VALUES.recolorPreserveLum
    .defaultValue as ToolValueBooleanType["defaultValue"],
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
      ...initialToolsState,
      zoom: state.zoom,
    }
  }

  // Handle union action payloads
  switch (action.type) {
    case "dimensions": {
      const { payload } = action as DimensionsToolAction
      return {
        ...state,
        dimensions: {
          width: Math.max(0, Number(payload?.width) || 0),
          height: Math.max(0, Number(payload?.height) || 0),
          x: Math.max(0, Number(payload?.x) || 0),
          y: Math.max(0, Number(payload?.y) || 0),
        },
      }
    }
    case "crop": {
      const { payload } = action as CropToolAction

      return {
        ...state,
        crop: {
          x: Math.max(0, Number(payload?.x ?? state.crop?.x ?? 0)),
          y: Math.max(0, Number(payload?.y ?? state.crop?.y ?? 0)),
          width: Math.max(0, Number(payload?.width ?? state.crop?.width ?? 0)),
          height: Math.max(
            0,
            Number(payload?.height ?? state.crop?.height ?? 0)
          ),
          overlay:
            (payload?.overlay as any) ??
            (state.crop as any)?.overlay ??
            "thirdGrid",
        },
      }
    }
    case "recolor": {
      const { payload } = action as RecolorToolAction
      return {
        ...state,
        recolor: {
          value: Math.max(0, Number(payload?.value) || 0),
          color: typeof payload?.color === "string" ? payload.color : "#000000",
        },
      }
    }
    case "solid": {
      const { payload } = action as SolidToolAction
      return {
        ...state,
        solid: typeof payload === "string" ? payload : state.solid,
      }
    }

    default: {
      const { type, payload } = action as NumericToolAction
      return {
        ...state,
        [type]: payload,
      } as ImageEditorToolsState
    }
  }
}
