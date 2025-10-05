// Legacy Track type retained for compatibility in types only. Runtime now uses
// the canonical animation/model Track shape: { keyframes: [{ timeSec, value }], interpolation, ... }.
import type { Track as CanonicalTrack } from "@/lib/animation/model"
import {
  sampleTrackScalar,
  sampleTrackAngle,
  sampleTrackBoolean,
  sampleTrackEnum,
  sampleTrackVec,
} from "@/lib/animation/model"
import {
  createCanonicalTrack,
  setInterpolationCanonical,
  addOrUpdateKeyframeCanonical,
  removeKeyframeCanonical,
  moveKeyframeCanonical,
} from "@/lib/animation/crud"
import { GlobalKeyframePluginRegistry } from "@/lib/animation/plugins"

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
export type ToolValueCropType = {
  x: number
  y: number
  width: number
  height: number
  overlay: "thirdGrid" | "goldenSpiral" | "grid" | "diagonals"
  defaultValue: {
    x: number
    y: number
    width: number
    height: number
    overlay: "thirdGrid" | "goldenSpiral" | "grid" | "diagonals"
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
  | RotateType
  | DimensionsType
  | CropType
  | ScaleType
  | UpscaleType

export const defaultToolValues: Record<string, ToolValueTypes> = {
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
} as const

export type DimensionsToolsType = {
  dimensions: Track
  // Viewport zoom is not keyframed in step 1; keep as number
  zoom: number
}

export type RotateToolsType = {
  rotate: Track
  scale: Track
  flipVertical: Track
  flipHorizontal: Track
}

export type CropToolsType = {
  crop: Track
}

export type ScaleToolsType = {
  scale: Track
}

export type UpscaleToolsType = {
  upscale: Track
}

export type AdjustLayersType = {
  brightness: Track
  contrast: Track
  exposure: Track
  gamma: Track
  grayscale: Track
  hue: Track
  invert: Track
  saturation: Track
  solid: string
  vintage: Track
  temperature: Track
  tint: Track
  colorizeHue: Track
  colorizeSaturation: Track
  colorizeLightness: Track
  colorizePreserveLum: Track
  colorizeAmount: Track
  vibrance: Track
  sharpenAmount: Track
  sharpenRadius: Track
  sharpenThreshold: Track
  noiseAmount: Track
  noiseSize: Track
  gaussianAmount: Track
  gaussianRadius: Track
  sepia: Track
}

export type AdjustmentType = keyof AdjustLayersType
export type RotateType = keyof RotateToolsType
export type DimensionsType = keyof DimensionsToolsType
export type CropType = keyof CropToolsType
export type ScaleType = keyof ScaleToolsType
export type UpscaleType = keyof UpscaleToolsType

// Keyframe/Track scaffolding
export type EasingKind =
  | "linear"
  | "stepped"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "cubicBezier"

export type Keyframe<T = any> = {
  t: number // seconds
  v: T
  easing?: EasingKind
  // Optional bezier controls if easing === "cubicBezier"
  bezier?: { x1: number; y1: number; x2: number; y2: number }
}

export type Track<T = unknown> = CanonicalTrack<T>

export function createTrack<T = unknown>(
  param: string,
  initialValue: T,
  stepped?: boolean
): Track<T> {
  // Create canonical track
  // Use plugin seeder for the initial keyframe at t=0 when available
  let tr = createCanonicalTrack<T>(param, initialValue)
  try {
    const seed = GlobalKeyframePluginRegistry.createSeed(param, initialValue)
    tr = { ...tr, keyframes: [seed] }
  } catch {}
  if (stepped) return setInterpolationCanonical(tr, "step") as Track<T>
  return tr as Track<T>
}

export function sampleTrack<T = unknown>(track: Track<T>, t: number): T {
  if (
    !(
      track &&
      typeof track === "object" &&
      Array.isArray((track as any).keyframes)
    )
  ) {
    throw new Error("sampleTrack requires canonical Track")
  }
  const { kind } = track as any
  switch (kind) {
    case "scalar":
    case "percentage":
      return sampleTrackScalar(track as any, t) as any
    case "angle":
      return sampleTrackAngle(track as any, t) as any
    case "boolean":
      return sampleTrackBoolean(track as any, t) as any
    case "enum":
      return sampleTrackEnum(track as any, t) as any
    case "vec2":
    case "vec3":
    case "vec4":
    case "color":
      return sampleTrackVec(track as any, t) as any
    default:
      return sampleTrackScalar(track as any, t) as any
  }
}

export function addOrUpdateKeyframe<T = unknown>(
  track: Track<T>,
  t: number,
  v: T
): Track<T> {
  if (
    track &&
    typeof track === "object" &&
    Array.isArray((track as any).keyframes)
  ) {
    return addOrUpdateKeyframeCanonical(track as any, t, v) as Track<T>
  }
  throw new Error("addOrUpdateKeyframe requires canonical Track")
}

export function removeKeyframe<T = unknown>(
  track: Track<T>,
  t: number
): Track<T> {
  if (
    track &&
    typeof track === "object" &&
    Array.isArray((track as any).keyframes)
  ) {
    return removeKeyframeCanonical(track as any, t) as Track<T>
  }
  throw new Error("removeKeyframe requires canonical Track")
}

// ===== Keyframe/Track utilities for Timeline UI =====

export function isTrack(value: unknown): value is Track {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as any).keyframes)
  )
}

export function findKeyframeIndex<T = unknown>(
  track: Track<T>,
  t: number,
  epsilon = 1e-6
): number {
  const frames = (track as any).keyframes as Array<{ timeSec: number }>
  for (let i = 0; i < frames.length; i += 1) {
    if (Math.abs(frames[i].timeSec - t) <= epsilon) return i
  }
  return -1
}

export function moveKeyframe<T = unknown>(
  track: Track<T>,
  fromT: number,
  toT: number
): Track<T> {
  if (
    track &&
    typeof track === "object" &&
    Array.isArray((track as any).keyframes)
  ) {
    return moveKeyframeCanonical(track as any, fromT, toT) as Track<T>
  }
  throw new Error("moveKeyframe requires canonical Track")
}

export function listTracksInToolsState(
  tools: Record<string, unknown>
): Array<{ key: string; track: Track<any> }> {
  const out: Array<{ key: string; track: Track<any> }> = []
  for (const [key, value] of Object.entries(tools)) {
    if (key === "history" || key === "historyPosition") continue
    if (isTrack(value)) out.push({ key, track: value })
  }
  return out
}

export function ensureTrackOnToolsState<T = unknown>(
  tools: Record<string, any>,
  key: string,
  initialValue: T,
  stepped?: boolean
): Record<string, any> {
  const current = tools[key]
  if (isTrack(current)) return tools
  return { ...tools, [key]: createTrack<T>(key, initialValue, stepped) }
}

// ===== Smart keyframe capture helpers =====

export function getDefaultValueForParam(
  key: string,
  toolValues: Record<string, ToolValueTypes>
): unknown {
  const spec: any = (toolValues as any)[key]
  if (spec && (spec as any).defaultValue !== undefined) {
    return spec.defaultValue
  }
  return undefined
}

function numbersClose(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps
}

export function isValueModifiedFromDefault(
  key: string,
  value: unknown,
  toolValues: Record<string, ToolValueTypes>,
  eps = 1e-6
): boolean {
  const def = getDefaultValueForParam(key, toolValues)
  if (typeof value === "number" && typeof def === "number") {
    return !numbersClose(value, def, eps)
  }
  if (typeof value === "boolean" && typeof def === "boolean") {
    return value !== def
  }
  if (
    value &&
    typeof value === "object" &&
    def &&
    typeof def === "object" &&
    !Array.isArray(value) &&
    !Array.isArray(def)
  ) {
    // shallow compare object fields
    const v = value as Record<string, unknown>
    const d = def as Record<string, unknown>
    const keys = new Set([...Object.keys(v), ...Object.keys(d)])
    for (const k of keys) {
      const a = v[k]
      const b = d[k]
      if (typeof a === "number" && typeof b === "number") {
        if (!numbersClose(a, b, eps)) return true
      } else if (a !== b) {
        return true
      }
    }
    return false
  }
  // If def is undefined, be conservative and consider modified only if value is truthy/non-zero
  if (typeof value === "number") return !numbersClose(value, 0, eps)
  if (typeof value === "boolean") return value !== false
  if (typeof value === "string") return value.length > 0
  return Boolean(value)
}

export function collectModifiedKeysFromSample(
  sampled: Record<string, unknown>,
  toolValues: Record<string, ToolValueTypes>
): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(sampled)) {
    if (key === "history" || key === "historyPosition" || key === "solid")
      continue
    if (isValueModifiedFromDefault(key, value, toolValues)) out.push(key)
  }
  return out
}
