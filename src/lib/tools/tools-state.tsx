import {
  createTrack,
  addOrUpdateKeyframe,
  type ToolValueStepType,
  type ToolValueTypes,
} from "@/lib/tools/tools"

export type ImageEditorToolsState = Record<string, any>

export const SIDEBAR_TOOLS = {
  scale: ["scale"],
  dimensions: ["dimensions"],
  dimensionsCanvas: ["dimensionsCanvas"],
  upscale: ["upscale"],
  crop: ["crop"],
  rotate: ["rotate", "flipVertical", "flipHorizontal"],
  move: ["move"],
}
export type SidebarToolsKeys = keyof typeof SIDEBAR_TOOLS

// Define payload types for non-numeric tools
type DimensionsPayload = { width: number; height: number; x: number; y: number }
type CropPayload = {
  x: number
  y: number
  width: number
  height: number
  overlay: "thirdGrid" | "goldenSpiral" | "grid" | "diagonals"
}

type NumericToolKeys = Exclude<
  string,
  "dimensions" | "crop" | "colorize" | "solid"
>

export type NumericToolAction = {
  type: NumericToolKeys | "zoom"
  payload: number
  t?: number
}

export type DimensionsToolAction = {
  type: "dimensions"
  payload: DimensionsPayload
}

export type CropToolAction = {
  type: "crop"
  payload: CropPayload
}

export type SolidToolAction = {
  type: "solid"
  payload: string
}

export type ImageEditorToolsAction =
  | NumericToolAction
  | DimensionsToolAction
  | CropToolAction
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
    type: string
    value: number
  }
}

export type ImageEditorToolsActions =
  | ImageEditorToolsAction
  | ImageEditorToolsResetAction
  | ImageEditorToolsHistoryAction
  | ImageEditorToolsUpdateHistoryAction

// Helper: sample a track-like or raw value at time t
function sampleMaybeTrack(value: unknown, t: number): any {
  // Canonical-only
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as any)?.keyframes)
  ) {
    const track = value as any
    const kind = track.kind
    const m = require("@/lib/animation/model") as any
    switch (kind) {
      case "scalar":
      case "percentage":
        return m.sampleTrackScalar(track, t)
      case "angle":
        return m.sampleTrackAngle(track, t)
      case "boolean":
        return m.sampleTrackBoolean(track, t)
      case "enum":
        return m.sampleTrackEnum(track, t)
      case "vec2":
      case "vec3":
      case "vec4":
      case "color":
        return m.sampleTrackVec(track, t)
      default:
        return m.sampleTrackScalar(track, t)
    }
  }
  // No legacy and no static fallbacks allowed
  throw new Error("tools-state: expected canonical Track for sampling")
}

export function sampleToolsAtTime(
  state: ImageEditorToolsState,
  t: number
): any {
  const out: any = {}
  for (const [k, v] of Object.entries(state as any)) {
    if (k === "history" || k === "historyPosition") {
      continue
    }
    if (k === "solid") {
      out[k] = v
      continue
    }
    // Non-keyframed structural UI values
    if (k === "zoom") {
      out[k] = v
      continue
    }
    // Sample only canonical Tracks; pass through non-track values (e.g., rotate/flip/dimensions/crop during migration)
    if (v && typeof v === "object" && Array.isArray((v as any)?.keyframes)) {
      out[k] = sampleMaybeTrack(v, t)
      continue
    }
    out[k] = v
  }
  return out
}

export type HistoryToolsState = {
  history: ImageEditorToolsAction[]
  historyPosition: number
}

export const createInitialToolsState = (
  toolValues: Record<string, ToolValueTypes>
) => {
  const state: ImageEditorToolsState = {
    // History values
    history: [],
    historyPosition: 0,

    // Rotate values
    flipHorizontal: createTrack<boolean>(
      "flipHorizontal",
      Boolean((toolValues.flipHorizontal as any).defaultValue || 0)
    ) as any,
    flipVertical: createTrack<boolean>(
      "flipVertical",
      Boolean((toolValues.flipVertical as any).defaultValue || 0)
    ) as any,
    rotate: createTrack(
      "rotate",
      toolValues.rotate.defaultValue as ToolValueStepType["defaultValue"]
    ),

    crop: createTrack("crop", toolValues.crop.defaultValue),

    dimensions: createTrack("dimensions", toolValues.dimensions.defaultValue),

    scale: createTrack(
      "scale",
      toolValues.scale.defaultValue as ToolValueStepType["defaultValue"]
    ),

    upscale: createTrack(
      "upscale",
      toolValues.upscale.defaultValue as ToolValueStepType["defaultValue"]
    ),

    zoom: toolValues.zoom.defaultValue as ToolValueStepType["defaultValue"],
  } as ImageEditorToolsState

  for (const [key, value] of Object.entries(toolValues)) {
    state[key] = createTrack(key, value.defaultValue)
  }

  return state
}

export function imageEditorToolsReducer(
  state: ImageEditorToolsState,
  action: ImageEditorToolsActions,
  initialToolsState: ImageEditorToolsState
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
      const nextDims = addOrUpdateKeyframe(
        state.dimensions as any,
        (action as any).t ?? 0,
        {
          width: Math.max(0, Number(payload?.width) || 0),
          height: Math.max(0, Number(payload?.height) || 0),
          x: Number(payload?.x ?? 0) || 0,
          y: Number(payload?.y ?? 0) || 0,
        }
      ) as any
      return {
        ...state,
        dimensions: nextDims,
      }
    }
    case "crop": {
      const { payload } = action as CropToolAction
      const prev = (() => {
        const tr: any = (state as any).crop
        if (tr && typeof tr === "object" && Array.isArray(tr.keyframes)) {
          const kfs = tr.keyframes as Array<{ timeSec: number; value: any }>
          const last = kfs.length > 0 ? kfs[kfs.length - 1].value : {}
          return last || {}
        }
        return {}
      })() as any
      const nextCrop = addOrUpdateKeyframe(
        state.crop as any,
        (action as any).t ?? 0,
        {
          x: Math.max(0, Number(payload?.x ?? prev.x ?? 0)),
          y: Math.max(0, Number(payload?.y ?? prev.y ?? 0)),
          width: Math.max(0, Number(payload?.width ?? prev.width ?? 0)),
          height: Math.max(0, Number(payload?.height ?? prev.height ?? 0)),
          overlay:
            (payload?.overlay as any) ?? (prev.overlay as any) ?? "thirdGrid",
        }
      ) as any
      return {
        ...state,
        crop: nextCrop,
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
      const { type, payload, t } = action as NumericToolAction
      const at = typeof t === "number" ? t : 0
      const current = (state as any)[type]
      // Zoom and structural payloads are not keyframed in step 1
      if (type === "zoom") {
        return { ...(state as any), zoom: payload } as ImageEditorToolsState
      }
      // For dimensions/crop we accept object payloads and set directly
      if (type === ("dimensions" as any)) {
        const next = addOrUpdateKeyframe(
          (state as any).dimensions,
          at,
          (action as any).payload as {
            width: number
            height: number
            x: number
            y: number
          }
        )
        return { ...(state as any), dimensions: next } as any
      }
      if (type === ("crop" as any)) {
        const next = addOrUpdateKeyframe(
          (state as any).crop,
          at,
          (action as any).payload as {
            x: number
            y: number
            width: number
            height: number
            overlay: "thirdGrid" | "goldenSpiral" | "grid" | "diagonals"
          }
        )
        return { ...(state as any), crop: next } as any
      }
      // Otherwise we expect a canonical Track; add or update keyframe at time t
      if (
        current &&
        typeof current === "object" &&
        Array.isArray((current as any).keyframes)
      ) {
        const next = addOrUpdateKeyframe(current as any, at, payload as any)
        return { ...(state as any), [type]: next } as any
      }
      // If not a Track, initialize a canonical track and set
      const next = createTrack(String(type), payload as any)
      return { ...(state as any), [type]: next } as any
    }
  }
}
