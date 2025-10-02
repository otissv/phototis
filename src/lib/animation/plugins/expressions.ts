export type ExpressionFn = (t: number, deps: Record<string, number>) => number

export interface ExpressionSpec {
  id: string
  label: string
  params: Record<
    string,
    {
      label: string
      defaultValue: number
      min?: number
      max?: number
      step?: number
    }
  >
  compile: (params: Record<string, number>) => ExpressionFn
}

export const expressions: Record<string, ExpressionSpec> = {
  sine: {
    id: "sine",
    label: "Sine",
    params: {
      amplitude: { label: "Amplitude", defaultValue: 1 },
      frequency: { label: "Frequency", defaultValue: 1 },
      phase: { label: "Phase", defaultValue: 0 },
      bias: { label: "Bias", defaultValue: 0 },
    },
    compile: (p) => {
      const a = p.amplitude ?? 1
      const f = p.frequency ?? 1
      const ph = p.phase ?? 0
      const b = p.bias ?? 0
      return (t) => b + a * Math.sin(2 * Math.PI * (t * f + ph))
    },
  },
  ramp: {
    id: "ramp",
    label: "Ramp",
    params: {
      slope: { label: "Slope", defaultValue: 1 },
      intercept: { label: "Intercept", defaultValue: 0 },
    },
    compile: (p) => {
      const m = p.slope ?? 1
      const c = p.intercept ?? 0
      return (t) => m * t + c
    },
  },
  pulse: {
    id: "pulse",
    label: "Pulse",
    params: {
      frequency: { label: "Frequency", defaultValue: 1 },
      duty: { label: "Duty", defaultValue: 0.5 },
      amplitude: { label: "Amplitude", defaultValue: 1 },
    },
    compile: (p) => {
      const f = p.frequency ?? 1
      const d = Math.max(0, Math.min(1, p.duty ?? 0.5))
      const a = p.amplitude ?? 1
      return (t) => ((t * f) % 1 < d ? a : 0)
    },
  },
}
