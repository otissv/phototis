/*
  Keyframe Plugin System
  - KeyframePlugin interface for param-specific evaluation & UI schema
  - Registry for resolving tool/param → plugin and creating seeds
  - Categories: modulators, expressions, presets
  - Composition: base track → expression → modulators → clamp → output
*/

import type {
  EasingType,
  InterpolationType,
  ParamKind,
  Track,
  Keyframe,
  Timeline,
} from "./model"
import {
  clampPercentage,
  normalizeAngleRad,
  sampleTrackScalar,
  sampleTrackAngle,
  sampleTrackBoolean,
  sampleTrackEnum,
  sampleTrackVec,
} from "./model"

export type UISchema =
  | {
      type: "slider"
      label: string
      min: number
      max: number
      step?: number
      unit?: string
    }
  | {
      type: "toggle"
      label: string
    }
  | {
      type: "select"
      label: string
      options: { label: string; value: string }[]
    }
  | {
      type: "color"
      label: string
    }
  | {
      type: "vec"
      label: string
      dims: 2 | 3 | 4
    }
  | {
      type: "angle"
      label: string
    }

export interface PluginEvaluateContext {
  timeSec: number
}

export interface KeyframePlugin<T = unknown> {
  id: string
  label: string
  kinds: ParamKind[]
  supportedInterpolations: InterpolationType[]
  defaultEasing?: EasingType
  validateDomain?: (value: T) => boolean
  preprocess?: (value: T) => T
  postprocess?: (value: T) => T
  evaluate: (track: Track<T>, ctx: PluginEvaluateContext) => T
  createSeedKeyframe: (value: T) => Keyframe<T>
  ui: UISchema
}

export class KeyframePluginRegistry {
  private plugins = new Map<string, KeyframePlugin<any>>()
  private paramToPlugin = new Map<string, string>()

  register(plugin: KeyframePlugin<any>): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`)
    }
    this.plugins.set(plugin.id, plugin)
  }

  bindParam(paramId: string, pluginId: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Unknown plugin: ${pluginId}`)
    }
    this.paramToPlugin.set(paramId, pluginId)
  }

  resolve(paramId: string): KeyframePlugin<any> {
    const id = this.paramToPlugin.get(paramId)
    if (!id) throw new Error(`No plugin bound for param: ${paramId}`)
    const p = this.plugins.get(id)
    if (!p) throw new Error(`Plugin not found: ${id}`)
    return p
  }

  createSeed<T>(paramId: string, value: T): Keyframe<T> {
    const p = this.resolve(paramId) as KeyframePlugin<T>
    return p.createSeedKeyframe(value)
  }

  getMetadata(paramId: string): {
    label: string
    ui: UISchema
    kinds: ParamKind[]
    easing?: EasingType
    interpolations: InterpolationType[]
  } {
    const p = this.resolve(paramId)
    return {
      label: p.label,
      ui: p.ui,
      kinds: p.kinds,
      easing: p.defaultEasing,
      interpolations: p.supportedInterpolations,
    }
  }
}

// Built-in plugins
export const ScalarPlugin: KeyframePlugin<number> = {
  id: "scalar",
  label: "Scalar",
  kinds: ["scalar", "percentage"],
  supportedInterpolations: ["linear", "bezier", "step", "catmullRom"],
  defaultEasing: "linear",
  validateDomain: (v) => Number.isFinite(v),
  preprocess: (v) => v,
  postprocess: (v) => v,
  evaluate: (track, ctx) => {
    const v =
      track.kind === "percentage"
        ? clampPercentage(sampleTrackScalar(track as any, ctx.timeSec))
        : sampleTrackScalar(track as any, ctx.timeSec)
    return v as number
  },
  createSeedKeyframe: (value) => ({ timeSec: 0, value }),
  ui: { type: "slider", label: "Value", min: 0, max: 100 },
}

export const AnglePlugin: KeyframePlugin<number> = {
  id: "angle",
  label: "Angle",
  kinds: ["angle"],
  supportedInterpolations: ["linear", "bezier", "step", "slerp"],
  defaultEasing: "linear",
  preprocess: (v) => normalizeAngleRad(v),
  postprocess: (v) => normalizeAngleRad(v),
  evaluate: (track, ctx) => sampleTrackAngle(track as any, ctx.timeSec),
  createSeedKeyframe: (value) => ({ timeSec: 0, value }),
  ui: { type: "angle", label: "Angle" },
}

export const BooleanPlugin: KeyframePlugin<boolean> = {
  id: "boolean",
  label: "Boolean",
  kinds: ["boolean"],
  supportedInterpolations: ["step"],
  defaultEasing: "linear",
  evaluate: (track, ctx) => sampleTrackBoolean(track as any, ctx.timeSec),
  createSeedKeyframe: (value) => ({ timeSec: 0, value }),
  ui: { type: "toggle", label: "Enabled" },
}

export const EnumPlugin: KeyframePlugin<string> = {
  id: "enum",
  label: "Enum",
  kinds: ["enum"],
  supportedInterpolations: ["step"],
  defaultEasing: "linear",
  evaluate: (track, ctx) => sampleTrackEnum(track as any, ctx.timeSec),
  createSeedKeyframe: (value) => ({ timeSec: 0, value }),
  ui: { type: "select", label: "Option", options: [] },
}

export const VecPlugin: KeyframePlugin<any> = {
  id: "vector",
  label: "Vector",
  kinds: ["vec2", "vec3", "vec4"],
  supportedInterpolations: ["linear", "bezier", "step", "catmullRom"],
  defaultEasing: "linear",
  evaluate: (track, ctx) => sampleTrackVec(track as any, ctx.timeSec),
  createSeedKeyframe: (value) => ({ timeSec: 0, value }),
  ui: { type: "vec", label: "Value", dims: 2 },
}

export const ColorPlugin: KeyframePlugin<[number, number, number, number]> = {
  id: "color",
  label: "Color",
  kinds: ["color"],
  supportedInterpolations: ["linear", "bezier", "step"],
  defaultEasing: "linear",
  evaluate: (track, ctx) => sampleTrackVec(track as any, ctx.timeSec) as any,
  createSeedKeyframe: (value) => ({ timeSec: 0, value }),
  ui: { type: "color", label: "Color" },
}

// Categories
export type Modulator = (base: number, timeSec: number) => number
export type Expression = (t: number, deps: Record<string, number>) => number
export type PresetTemplate = (durationSec: number) => Keyframe<number>[]

export const LFO: Modulator = (base, t) =>
  base + Math.sin(t * 2 * Math.PI) * base * 0.1
export const Noise: Modulator = (base, t) =>
  base + (hash(t) - 0.5) * base * 0.05
export const RandomStep: Modulator = (base, t) =>
  base + (hash(Math.floor(t)) - 0.5) * base * 0.1

function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

export function composeSample(
  base: number,
  t: number,
  expression?: Expression,
  modulators?: Modulator[],
  clampPercent?: boolean
): number {
  let v = base
  if (expression) v = expression(t, { t })
  if (modulators) for (const m of modulators) v = m(v, t)
  if (clampPercent) v = clampPercentage(v)
  return v
}
