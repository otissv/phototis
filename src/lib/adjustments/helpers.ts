export type AdjustmentParamValue = number | { value: number; color: string }

export const identityToShader = (
  params: Record<string, AdjustmentParamValue>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) out[k] = v
  return out
}

export function hexToRgba01(
  hex: string
): [number, number, number, number] | null {
  const m = hex.replace(/^#/, "").toLowerCase()
  if (m.length === 3) {
    const r = Number.parseInt(m[0] + m[0], 16)
    const g = Number.parseInt(m[1] + m[1], 16)
    const b = Number.parseInt(m[2] + m[2], 16)
    return [r / 255, g / 255, b / 255, 1]
  }
  if (m.length === 4) {
    const r = Number.parseInt(m[0] + m[0], 16)
    const g = Number.parseInt(m[1] + m[1], 16)
    const b = Number.parseInt(m[2] + m[2], 16)
    const a = Number.parseInt(m[3] + m[3], 16)
    return [r / 255, g / 255, b / 255, a / 255]
  }
  if (m.length === 6) {
    const r = Number.parseInt(m.slice(0, 2), 16)
    const g = Number.parseInt(m.slice(2, 4), 16)
    const b = Number.parseInt(m.slice(4, 6), 16)
    return [r / 255, g / 255, b / 255, 1]
  }
  if (m.length === 8) {
    const r = Number.parseInt(m.slice(0, 2), 16)
    const g = Number.parseInt(m.slice(2, 4), 16)
    const b = Number.parseInt(m.slice(4, 6), 16)
    const a = Number.parseInt(m.slice(6, 8), 16)
    return [r / 255, g / 255, b / 255, a / 255]
  }
  return null
}
