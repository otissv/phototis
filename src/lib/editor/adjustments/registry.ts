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

export const ADJUSTMENT_PLUGINS: readonly AdjustmentPlugin[] = [
  {
    id: "brightness",
    name: "Brightness",
    uiSchema: [
      {
        kind: "slider",
        key: "brightness",
        label: "Brightness",
        ...sliderDefaults("brightness"),
        sliderType: "grayscale",
      },
    ],
    defaults: {
      brightness: sliderDefaultValue("brightness") ?? 100,
    },
    toShaderParams: identityToShader,
  },
  {
    id: "contrast",
    name: "Contrast",
    uiSchema: [
      {
        kind: "slider",
        key: "contrast",
        label: "Contrast",
        ...sliderDefaults("contrast"),
        sliderType: "grayscale",
      },
    ],
    defaults: { contrast: sliderDefaultValue("contrast") ?? 100 },
    toShaderParams: identityToShader,
  },
  {
    id: "exposure",
    name: "Exposure",
    uiSchema: [
      {
        kind: "slider",
        key: "exposure",
        label: "Exposure",
        ...sliderDefaults("exposure"),
        sliderType: "grayscale",
      },
    ],
    defaults: { exposure: sliderDefaultValue("exposure") ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "gamma",
    name: "Gamma",
    uiSchema: [
      {
        kind: "slider",
        key: "gamma",
        label: "Gamma",
        ...sliderDefaults("gamma"),
        sliderType: "grayscale",
      },
    ],
    defaults: { gamma: sliderDefaultValue("gamma") ?? 1 },
    toShaderParams: identityToShader,
  },
  {
    id: "hue",
    name: "Hue",
    uiSchema: [
      {
        kind: "slider",
        key: "hue",
        label: "Hue",
        ...sliderDefaults("hue"),
        sliderType: "hue",
      },
    ],
    defaults: { hue: sliderDefaultValue("hue") ?? 180 },
    toShaderParams: identityToShader,
  },
  {
    id: "saturation",
    name: "Saturation",
    uiSchema: [
      {
        kind: "slider",
        key: "saturation",
        label: "Saturation",
        ...sliderDefaults("saturation"),
      },
    ],
    defaults: { saturation: sliderDefaultValue("saturation") ?? 100 },
    toShaderParams: identityToShader,
  },
  {
    id: "temperature",
    name: "Temperature",
    uiSchema: [
      {
        kind: "slider",
        key: "temperature",
        label: "Temperature",
        ...sliderDefaults("temperature"),
        sliderType: "grayscale",
      },
    ],
    defaults: { temperature: sliderDefaultValue("temperature") ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "vibrance",
    name: "Vibrance",
    uiSchema: [
      {
        kind: "slider",
        key: "vibrance",
        label: "Vibrance",
        ...sliderDefaults("vibrance"),
      },
    ],
    defaults: { vibrance: sliderDefaultValue("vibrance") ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "vintage",
    name: "Vintage",
    uiSchema: [
      {
        kind: "slider",
        key: "vintage",
        label: "Vintage",
        ...sliderDefaults("vintage"),
      },
    ],
    defaults: { vintage: sliderDefaultValue("vintage") ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "grayscale",
    name: "Grayscale",
    uiSchema: [
      {
        kind: "slider",
        key: "grayscale",
        label: "Grayscale",
        ...sliderDefaults("grayscale"),
        sliderType: "grayscale",
      },
    ],
    defaults: { grayscale: sliderDefaultValue("grayscale") ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "invert",
    name: "Invert",
    uiSchema: [{ kind: "toggle", key: "invert", label: "Invert" }],
    defaults: { invert: (TOOL_VALUES.invert as any)?.defaultValue ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "sepia",
    name: "Sepia",
    uiSchema: [
      {
        kind: "slider",
        key: "sepia",
        label: "Sepia",
        ...sliderDefaults("sepia"),
      },
    ],
    defaults: { sepia: (TOOL_VALUES.sepia as any)?.defaultValue ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "blur",
    name: "Blur",
    uiSchema: [
      { kind: "slider", key: "blur", label: "Blur", ...sliderDefaults("blur") },
      {
        kind: "slider",
        key: "blurType",
        label: "Blur Type",
        ...sliderDefaults("blurType"),
      },
      {
        kind: "slider",
        key: "blurDirection",
        label: "Direction",
        ...sliderDefaults("blurDirection"),
      },
      {
        kind: "slider",
        key: "blurCenter",
        label: "Center",
        ...sliderDefaults("blurCenter"),
      },
    ],
    defaults: {
      blur: (TOOL_VALUES.blur as any)?.defaultValue ?? 0,
      blurType: (TOOL_VALUES.blurType as any)?.defaultValue ?? 0,
      blurDirection: (TOOL_VALUES.blurDirection as any)?.defaultValue ?? 0,
      blurCenter: (TOOL_VALUES.blurCenter as any)?.defaultValue ?? 0.5,
    },
    toShaderParams: identityToShader,
  },
  {
    id: "noise",
    name: "Noise",
    uiSchema: [
      {
        kind: "slider",
        key: "noise",
        label: "Noise",
        ...sliderDefaults("noise"),
      },
    ],
    defaults: { noise: (TOOL_VALUES.noise as any)?.defaultValue ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "grain",
    name: "Grain",
    uiSchema: [
      {
        kind: "slider",
        key: "grain",
        label: "Grain",
        ...sliderDefaults("grain"),
      },
    ],
    defaults: { grain: (TOOL_VALUES.grain as any)?.defaultValue ?? 0 },
    toShaderParams: identityToShader,
  },
  {
    id: "recolor",
    name: "Recolor",
    uiSchema: [{ kind: "color+slider", key: "recolor", label: "Recolor" }],
    defaults: {
      recolor: (TOOL_VALUES.recolor as any)?.defaultValue ?? {
        value: 0,
        color: "#000000",
      },
    },
    toShaderParams: identityToShader,
  },
  {
    id: "solid",
    name: "Solid",
    uiSchema: [{ kind: "color", key: "solid", label: "Solid Color" }],
    defaults: { solid: (TOOL_VALUES.solid as any)?.defaultValue ?? "#000000" },
    toShaderParams: identityToShader,
  },
]

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
