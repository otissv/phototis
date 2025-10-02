import type { Modulator } from "@/lib/animation/plugins"

export type LfoType = "sine" | "triangle" | "square" | "saw"

export interface LfoParams {
  type: LfoType
  amplitude: number
  frequency: number
  phase: number
  bias?: number
}

export const lfo: (params: LfoParams) => Modulator = (params) => {
  const amplitude = Number.isFinite(params.amplitude) ? params.amplitude : 1
  const frequency = Number.isFinite(params.frequency) ? params.frequency : 1
  const phase = Number.isFinite(params.phase) ? params.phase : 0
  const bias = Number.isFinite(params.bias ?? 0) ? (params.bias as number) : 0
  return (base, t) => {
    const u = t * frequency + phase
    const osc = (() => {
      switch (params.type) {
        case "triangle": {
          const x = u - Math.floor(u)
          return 1 - Math.abs(2 * x - 1)
        }
        case "square": {
          const x = u - Math.floor(u)
          return x < 0.5 ? 1 : -1
        }
        case "saw": {
          const x = u - Math.floor(u)
          return 2 * x - 1
        }
        case "sine":
          return Math.sin(2 * Math.PI * u)
        default:
          return Math.sin(2 * Math.PI * u)
      }
    })()
    return base + amplitude * osc + bias
  }
}

export interface NoiseParams {
  amplitude: number
  frequency: number
  seed?: number
}

export const noise: (params: NoiseParams) => Modulator = (params) => {
  const amplitude = Number.isFinite(params.amplitude) ? params.amplitude : 1
  const frequency = Number.isFinite(params.frequency) ? params.frequency : 1
  const seed = Number.isFinite(params.seed ?? 0) ? (params.seed as number) : 0
  return (base, t) => base + amplitude * (hash(t * frequency + seed) - 0.5) * 2
}

export interface RandomStepParams {
  amplitude: number
  hold: number // seconds per step
  seed?: number
}

export const randomStep: (params: RandomStepParams) => Modulator = (params) => {
  const amplitude = Number.isFinite(params.amplitude) ? params.amplitude : 1
  const hold = Number.isFinite(params.hold) ? params.hold : 0.25
  const seed = Number.isFinite(params.seed ?? 0) ? (params.seed as number) : 0
  return (base, t) =>
    base + amplitude * (hash(Math.floor(t / hold) + seed) - 0.5) * 2
}

function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453
  return s - Math.floor(s)
}
