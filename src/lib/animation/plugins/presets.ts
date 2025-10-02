import type { Keyframe } from "@/lib/animation/model"

export interface PresetSpec {
  id: string
  label: string
  description?: string
  generate: (durationSec: number) => Keyframe<number>[]
}

export const presets: Record<string, PresetSpec> = {
  bounce: {
    id: "bounce",
    label: "Bounce In",
    description: "Ease-in bounce to target over duration",
    generate: (d) => {
      const k: Keyframe<number>[] = []
      const steps = 8
      for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * d
        const u = i / steps
        const b = Math.pow(2, -6 * u) * Math.cos(10 * Math.PI * u)
        k.push({ timeSec: t, value: 1 - b, easing: "linear" })
      }
      return k
    },
  },
  pingpong: {
    id: "pingpong",
    label: "Ping-Pong",
    description: "Oscillate between 0 and 1",
    generate: (d) => [
      { timeSec: 0, value: 0 },
      { timeSec: d * 0.5, value: 1 },
      { timeSec: d, value: 0 },
    ],
  },
}
