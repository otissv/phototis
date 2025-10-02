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
import { expressions as ExpressionLibrary } from "@/lib/animation/plugins/expressions"
import {
  lfo as LFO,
  noise as Noise,
  randomStep as RandomStep,
} from "@/lib/animation/plugins/modulators"

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

// Global registry instance and default bindings for common params
export const GlobalKeyframePluginRegistry = new KeyframePluginRegistry()

// Bind common parameter ids → plugins (extend as needed)
const DEFAULT_SCALAR_PARAMS = [
  "brightness",
  "contrast",
  "saturation",
  "exposure",
  "gamma",
  "grayscale",
  "invert",
  "temperature",
  "tint",
  "vibrance",
  "sepia",
  "vintage",
  "gaussianAmount",
  "gaussianRadius",
  "noiseAmount",
  "noiseSize",
  "sharpenAmount",
  "sharpenRadius",
  "sharpenThreshold",
  "colorizeHue",
  "colorizeSaturation",
  "colorizeLightness",
  "colorizeAmount",
  "rotate",
  "scale",
]

const DEFAULT_ANGLE_PARAMS = ["hue", "angle"]
const DEFAULT_BOOLEAN_PARAMS = [
  "flipHorizontal",
  "flipVertical",
  "colorizePreserveLum",
]
// Composite object fields bound as individual scalar params for auto-UI
const DEFAULT_OBJECT_FIELD_PARAMS = [
  // crop
  "crop.x",
  "crop.y",
  "crop.width",
  "crop.height",
  // dimensions (move)
  "dimensions.x",
  "dimensions.y",
  "dimensions.width",
  "dimensions.height",
]

export function initializeDefaultKeyframePlugins(): void {
  ;[
    ScalarPlugin,
    AnglePlugin,
    BooleanPlugin,
    EnumPlugin,
    VecPlugin,
    ColorPlugin,
  ].forEach((p) => {
    try {
      GlobalKeyframePluginRegistry.register(p)
    } catch {}
  })
  DEFAULT_SCALAR_PARAMS.forEach((param) => {
    try {
      GlobalKeyframePluginRegistry.bindParam(param, "scalar")
    } catch {}
  })
  DEFAULT_ANGLE_PARAMS.forEach((param) => {
    try {
      GlobalKeyframePluginRegistry.bindParam(param, "angle")
    } catch {}
  })
  DEFAULT_BOOLEAN_PARAMS.forEach((param) => {
    try {
      GlobalKeyframePluginRegistry.bindParam(param, "boolean")
    } catch {}
  })
  DEFAULT_OBJECT_FIELD_PARAMS.forEach((param) => {
    try {
      GlobalKeyframePluginRegistry.bindParam(param, "scalar")
    } catch {}
  })
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
    const base = sampleTrackScalar(track as any, ctx.timeSec) as number
    const expr = buildExpression((track as any).expression)
    const mods = buildModulators((track as any).modulators)
    const clamp = (track as any).kind === "percentage"
    return composeSample(base, ctx.timeSec, expr, mods, clamp)
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
  evaluate: (track, ctx) => {
    const base = sampleTrackAngle(track as any, ctx.timeSec) as number
    const expr = buildExpression((track as any).expression)
    const mods = buildModulators((track as any).modulators)
    const v = composeSample(base, ctx.timeSec, expr, mods, false)
    return normalizeAngleRad(v)
  },
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

// Deprecated inline modulators removed in favor of dedicated modules

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

export function buildExpression(
  binding: { id: string; params: Record<string, unknown> } | null | undefined
): Expression | undefined {
  if (!binding) return undefined
  const spec = ExpressionLibrary[binding.id]
  if (!spec) return undefined
  const numericParams: Record<string, number> = {}
  for (const [k, v] of Object.entries(binding.params || {})) {
    const n = Number(v as any)
    if (Number.isFinite(n)) numericParams[k] = n
  }
  return spec.compile(numericParams)
}

export function buildModulators(
  bindings:
    | Array<{ id: string; params: Record<string, unknown> }>
    | null
    | undefined
): Modulator[] {
  if (!bindings || bindings.length === 0) return []
  const out: Modulator[] = []
  for (const b of bindings) {
    const params = b.params || {}
    switch (b.id) {
      case "lfo":
        out.push(
          LFO({
            type: (params.type as any) ?? "sine",
            amplitude: Number(params.amplitude) || 1,
            frequency: Number(params.frequency) || 1,
            phase: Number(params.phase) || 0,
            bias: Number(params.bias) || 0,
          })
        )
        break
      case "noise":
        out.push(
          Noise({
            amplitude: Number(params.amplitude) || 1,
            frequency: Number(params.frequency) || 1,
            seed: Number(params.seed) || 0,
          })
        )
        break
      case "randomStep":
        out.push(
          RandomStep({
            amplitude: Number(params.amplitude) || 1,
            hold: Number(params.hold) || 0.25,
            seed: Number(params.seed) || 0,
          })
        )
        break
      default:
        break
    }
  }
  return out
}
