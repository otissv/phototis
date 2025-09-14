import type { AdjustmentTypes } from "@/lib/editor/types.adjustment"
import { TOOL_VALUES } from "@/lib/tools/tools"

export type AdjustmentParamValue = number | { value: number; color: string }

export type AdjustmentPlugin = {
  id: AdjustmentTypes
  name: string
  // UI schema describing how to render controls for this adjustment
  uiSchema: Array<
    | {
        kind: "slider"
        key: string
        label?: string
        min?: number
        max?: number
        step?: number
        sliderType?: "default" | "hue" | "grayscale"
      }
    | { kind: "toggle"; key: string; label?: string }
    | { kind: "color"; key: string; label?: string }
    | { kind: "color+slider"; key: string; label?: string }
  >
  // Default layer.parameters for this plugin (UI-level parameters)
  defaults: Record<string, AdjustmentParamValue>
  // Map UI-level parameters to shader parameter keys expected by validateFilterParameters()
  toShaderParams: (
    params: Record<string, AdjustmentParamValue>
  ) => Record<string, unknown>
}

function sliderDefaults(key: keyof typeof TOOL_VALUES): {
  min?: number
  max?: number
  step?: number
} {
  const def = (TOOL_VALUES as Record<string, any>)[key]
  if (!def) return {}
  return {
    min: typeof def.min === "number" ? def.min : undefined,
    max: typeof def.max === "number" ? def.max : undefined,
    step: typeof def.step === "number" ? def.step : undefined,
  }
}

function sliderDefaultValue(key: keyof typeof TOOL_VALUES): number | undefined {
  const def = (TOOL_VALUES as Record<string, any>)[key]
  return typeof def?.defaultValue === "number"
    ? (def.defaultValue as number)
    : undefined
}

const identityToShader = (
  params: Record<string, AdjustmentParamValue>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) out[k] = v
  return out
}

// As per new architecture: each adjustment is a standalone plugin module.
// Keep the export but import all plugins from './plugins' index for aggregation.
import { PLUGINS as ADJUSTMENT_PLUGINS } from "./plugins"

export function getAdjustmentPlugin(
  id: AdjustmentTypes
): AdjustmentPlugin | undefined {
  return ADJUSTMENT_PLUGINS.find((p) => p.id === id)
}

export function getAdjustmentsForTier(): AdjustmentPlugin[] {
  const order = new Map<AdjustmentTypes, number>()
  ADJUSTMENT_PLUGINS.forEach((p, i) => order.set(p.id, i))
  return ADJUSTMENT_PLUGINS.slice().sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  )
}

export function getDefaultParameters(
  id: AdjustmentTypes
): Record<string, AdjustmentParamValue> {
  const p = getAdjustmentPlugin(id)
  return p ? { ...p.defaults } : {}
}

export function mapParametersToShader(
  id: AdjustmentTypes,
  params: Record<string, AdjustmentParamValue>
): Record<string, unknown> {
  const p = getAdjustmentPlugin(id)
  return p ? p.toShaderParams(params) : { ...params }
}
