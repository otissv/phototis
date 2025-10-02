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
  const a = Number.isFinite(params.amplitude) ? params.amplitude : 1
  const f = Number.isFinite(params.frequency) ? params.frequency : 1
  const p = Number.isFinite(params.phase) ? params.phase : 0
  const b = Number.isFinite(params.bias ?? 0) ? (params.bias as number) : 0
  return (base, t) => {
    const u = t * f + p
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
        default:
          return Math.sin(2 * Math.PI * u)
      }
    })()
    return base + a * osc + b
  }
}

export interface NoiseParams {
  amplitude: number
  frequency: number
  seed?: number
}

export const noise: (params: NoiseParams) => Modulator = (params) => {
  const a = Number.isFinite(params.amplitude) ? params.amplitude : 1
  const f = Number.isFinite(params.frequency) ? params.frequency : 1
  const s = Number.isFinite(params.seed ?? 0) ? (params.seed as number) : 0
  return (base, t) => base + a * (hash(t * f + s) - 0.5) * 2
}

export interface RandomStepParams {
  amplitude: number
  hold: number // seconds per step
  seed?: number
}

export const randomStep: (params: RandomStepParams) => Modulator = (params) => {
  const a = Number.isFinite(params.amplitude) ? params.amplitude : 1
  const h = Number.isFinite(params.hold) ? params.hold : 0.25
  const s = Number.isFinite(params.seed ?? 0) ? (params.seed as number) : 0
  return (base, t) => base + a * (hash(Math.floor(t / h) + s) - 0.5) * 2
}

function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453
  return s - Math.floor(s)
}
