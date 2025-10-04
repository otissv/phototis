// Note: Keep this module standalone to avoid tight coupling with types

export type PassStep = {
  shaderName: string
  passId?: string
  uniforms: Record<string, unknown>
  withPreviousPass?: boolean
}

function prefixUniformKeys(
  params: Record<string, unknown>
): Record<string, unknown> {
  const uniforms: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    const uniformKey = key.startsWith("u_") ? key : `u_${key}`
    uniforms[uniformKey] = value
  }
  return uniforms
}

export function buildAdjustmentPasses(
  adjustmentType: string,
  mappedParams: Record<string, unknown>
): PassStep[] {
  const t = String(adjustmentType)
  const p: any = mappedParams || {}

  // Special-case multi-pass or non-standard shader name mappings
  if (t === "gaussian") {
    const radius = Math.max(0.1, Number(p.gaussianRadius ?? 1))
    const amount = Number(p.gaussianAmount ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) return []
    return [
      {
        shaderName: "adjustments.gaussian_blur",
        passId: "horizontal_blur",
        uniforms: prefixUniformKeys({ radius }),
      },
      {
        shaderName: "adjustments.gaussian_blur",
        passId: "vertical_blur",
        uniforms: prefixUniformKeys({ radius, amount }),
        withPreviousPass: true,
      },
    ]
  }

  // Default naming convention: adjustments.<id>
  let shaderName = `adjustments.${t}`
  if (t === "vintage") shaderName = "adjustments.vintage"
  if (t === "solid") shaderName = "adjustments.solid"

  // For single-pass adjustments, map params -> u_* uniforms generically.
  // This enables custom plugins as long as their shader expects u_* uniforms
  // whose names match the plugin parameters.
  const uniforms = (() => {
    if (t === "sharpen") {
      return prefixUniformKeys({
        sharpenAmount: Number(p.sharpenAmount ?? 0),
        sharpenRadius: Number(p.sharpenRadius ?? 1),
        sharpenThreshold: Number(p.sharpenThreshold ?? 0),
      })
    }
    if (t === "noise") {
      return prefixUniformKeys({
        noiseAmount: Number(p.noiseAmount ?? 0),
        noiseSize: Number(p.noiseSize ?? 1),
      })
    }
    // Solid and other adjustments: pass through generically
    return prefixUniformKeys(p)
  })()

  // Heuristic enable checks to avoid unnecessary passes for common defaults
  const shouldRun = (() => {
    if (t === "brightness") return Number(p.brightness ?? 100) !== 100
    if (t === "contrast") return Number(p.contrast ?? 100) !== 100
    if (t === "exposure") return Number(p.exposure ?? 0) !== 0
    if (t === "gamma") return Number(p.gamma ?? 1) !== 1
    if (t === "hue") return Number(p.hue ?? 0) !== 0
    if (t === "saturation") return Number(p.saturation ?? 100) !== 100
    if (t === "temperature") return Number(p.temperature ?? 0) !== 0
    if (t === "tint") return Number(p.tint ?? 0) !== 0
    if (t === "grayscale") return Number(p.grayscale ?? 0) > 0
    if (t === "invert") return Number(p.invert ?? 0) > 0
    if (t === "sepia") return Number(p.sepia ?? 0) > 0
    if (t === "vibrance") return Number(p.vibrance ?? 0) !== 0
    if (t === "colorize") return Number(p.colorizeAmount ?? 0) > 0
    if (t === "sharpen") return Number(p.sharpenAmount ?? 0) > 0
    if (t === "noise") return Number(p.noiseAmount ?? 0) > 0
    if (t === "solid")
      return Number(p.u_solidEnabled ?? p.solidEnabled ?? 0) === 1
    if (t === "vintage") return Number(p.vintage ?? 0) > 0
    // Unknown/custom: run once; plugin should decide no-op via uniforms
    return true
  })()

  if (!shouldRun) return []
  return [{ shaderName, uniforms }]
}

export function buildGlobalAdjustmentPasses(
  allParams: Record<string, unknown>
): PassStep[] {
  try {
    // Lazy require to avoid potential cycles during module init
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reg = require("@/lib/adjustments/plugins") as any
    const plugins: ReadonlyArray<{
      id: string
      defaults: Record<string, unknown>
      uiSchema?: Array<{ key: string }>
      toShaderParams: (p: Record<string, unknown>) => Record<string, unknown>
    }> = (reg?.PLUGINS as any[]) || []

    const steps: PassStep[] = []
    for (const plugin of plugins) {
      const keys = new Set<string>([
        ...Object.keys(plugin.defaults || {}),
        ...((plugin.uiSchema || [])
          .map((c: any) => c?.key)
          .filter(Boolean) as string[]),
      ])
      const subset: Record<string, unknown> = {}
      for (const k of keys) {
        if (k in allParams) subset[k] = (allParams as any)[k]
      }
      if (Object.keys(subset).length === 0) continue
      let mapped: Record<string, unknown>
      try {
        mapped = plugin.toShaderParams(subset)
      } catch {
        mapped = subset
      }
      const passSteps = buildAdjustmentPasses(String(plugin.id), mapped)
      for (const s of passSteps) steps.push(s)
    }
    return steps
  } catch {
    return []
  }
}
