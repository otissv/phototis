// Easing utilities: linear, easeIn, easeOut, easeInOut, cubic-bezier

export type CubicBezier = { x1: number; y1: number; x2: number; y2: number }

export type EasingFunction = (t: number) => number

export const linear: EasingFunction = (t) => clamp01(t)
export const easeIn: EasingFunction = (t) => {
  const s = clamp01(t)
  return s * s
}
export const easeOut: EasingFunction = (t) => {
  const s = clamp01(t)
  return 1 - (1 - s) * (1 - s)
}
export const easeInOut: EasingFunction = (t) => {
  const s = clamp01(t)
  return s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2
}

export function cubicBezier(p: CubicBezier): EasingFunction {
  // Evaluate cubic bezier at x=t, return y using Newton-Raphson for x -> t mapping
  const { x1, y1, x2, y2 } = p
  // Precompute coefficients for x and y
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx

  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  return (t: number) => {
    const x = clamp01(t)
    // Solve for parameter u given x, starting from u ~ x
    let u = x
    for (let i = 0; i < 5; i++) {
      const x2 = sampleX(u) - x
      const dx = sampleDX(u)
      if (Math.abs(x2) < 1e-5 || Math.abs(dx) < 1e-6) break
      u = clamp01(u - x2 / dx)
    }
    return clamp01(sampleY(u))
  }
}

export function getEasingFunction(
  kind: "linear" | "easeIn" | "easeOut" | "easeInOut" | "cubicBezier",
  bez?: CubicBezier
): EasingFunction {
  switch (kind) {
    case "easeIn":
      return easeIn
    case "easeOut":
      return easeOut
    case "easeInOut":
      return easeInOut
    case "cubicBezier":
      return cubicBezier(
        bez || { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 } // default ease
      )
    case "linear":
      return linear

    default:
      return linear
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
