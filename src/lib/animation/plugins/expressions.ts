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
      const amplitude = p.amplitude ?? 1
      const frequency = p.frequency ?? 1
      const phase = p.phase ?? 0
      const bias = p.bias ?? 0
      return (t) =>
        bias + amplitude * Math.sin(2 * Math.PI * (t * frequency + phase))
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
      const slope = p.slope ?? 1
      const intercept = p.intercept ?? 0
      return (t) => slope * t + intercept
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
      const frequency = p.frequency ?? 1
      const duty = Math.max(0, Math.min(1, p.duty ?? 0.5))
      const amplitude = p.amplitude ?? 1
      return (t) => ((t * frequency) % 1 < duty ? amplitude : 0)
    },
  },
}
