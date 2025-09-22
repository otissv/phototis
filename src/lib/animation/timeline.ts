// Timeline and keyframe sampling engine
// Supports scalar, vectors, boolean/enum (stepped), color (RGBA linear), and angles (shortest-arc)

export type Timebase = {
  fps: number // frames per second; used for UI snapping but sampling uses seconds
}

export type EasingType =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "cubicBezier"

export type InterpolationType = "stepped" | "linear" | "bezier" // for vectors/scalars when handles are provided

export type CubicBezier = { x1: number; y1: number; x2: number; y2: number }

export type Keyframe<T> = {
  time: number // seconds
  value: T
  easing?: EasingType
  interpolation?: InterpolationType
  bezier?: CubicBezier
  // Optional tangents for advanced curves; currently unused in sampling
  inTangent?: number | number[]
  outTangent?: number | number[]
}

export type ParamKind =
  | "scalar"
  | "boolean"
  | "enum"
  | "angle"
  | "percent"
  | "vec2"
  | "vec3"
  | "vec4"
  | "color" // RGBA in [0,1]
  | "object" // arbitrary structured (e.g., crop rect)

export type Track<T> = {
  id: string
  paramId: string
  kind: ParamKind
  keyframes: Keyframe<T>[]
  // Optional constraints/domain for clamping
  min?: number | number[]
  max?: number | number[]
}

export type ParameterTracks = Record<string, Track<any>>

// Memoization cache keyed by track-id + time
const sampleCache = new Map<string, any>()

function cacheKey(trackId: string, t: number): string {
  // Round time to microseconds to keep key stable across float noise
  const ti = Math.round(t * 1_000_000)
  return `${trackId}@${ti}`
}

// Utility: clamp number or each component of an array
function clampToDomain<T>(value: any, min?: any, max?: any): T {
  if (typeof value === "number") {
    const mi = typeof min === "number" ? min : -Infinity
    const ma = typeof max === "number" ? max : Infinity
    return Math.max(mi, Math.min(ma, value)) as unknown as T
  }
  if (Array.isArray(value)) {
    const out: number[] = []
    for (let i = 0; i < value.length; i++) {
      const v = Number(value[i])
      const mi = Array.isArray(min) ? Number(min[i] ?? -Infinity) : -Infinity
      const ma = Array.isArray(max) ? Number(max[i] ?? Infinity) : Infinity
      out.push(Math.max(mi, Math.min(ma, v)))
    }
    return out as unknown as T
  }
  return value as T
}

// sRGB <-> Linear helpers (component-wise, [0,1])
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function angleLerpDeg(a: number, b: number, t: number): number {
  // Interpolate along shortest arc in degrees [0,360)
  let delta = ((b - a + 540) % 360) - 180
  return (a + delta * t + 360) % 360
}

function applyEasing(t: number, easing?: EasingType): number {
  switch (easing) {
    case "easeIn":
      return t * t
    case "easeOut":
      return 1 - (1 - t) * (1 - t)
    case "easeInOut": {
      if (t < 0.5) return 2 * t * t
      const u = t - 0.5
      return 0.5 + (1 - (1 - 2 * u) * (1 - 2 * u)) / 2
    }
    case "linear":
    default:
      return t
  }
}

function binarySearchKeyframes<T>(
  keyframes: Keyframe<T>[],
  time: number
): number {
  // Returns index of right neighbor (first keyframe with time > t), or keyframes.length
  let lo = 0
  let hi = keyframes.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (keyframes[mid].time <= time) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function sampleTrack<T>(track: Track<T>, t: number): T {
  const ck = cacheKey(track.id, t)
  const cached = sampleCache.get(ck)
  if (typeof cached !== "undefined") return cached as T

  const kfs = track.keyframes
  if (kfs.length === 0)
    throw new Error(`Track ${track.paramId} has no keyframes`)
  if (kfs.length === 1) {
    const v1 = clampToDomain<T>(kfs[0].value, track.min, track.max)
    sampleCache.set(ck, v1)
    return v1
  }

  // Before first or after last: clamp to end keyframes
  if (t <= kfs[0].time) {
    const v0 = clampToDomain<T>(kfs[0].value, track.min, track.max)
    sampleCache.set(ck, v0)
    return v0
  }
  if (t >= kfs[kfs.length - 1].time) {
    const vL = clampToDomain<T>(kfs[kfs.length - 1].value, track.min, track.max)
    sampleCache.set(ck, vL)
    return vL
  }

  // Find neighbors
  const r = binarySearchKeyframes(kfs, t)
  const k0 = kfs[r - 1]
  const k1 = kfs[r]
  const span = k1.time - k0.time
  const raw = span <= 0 ? 0 : (t - k0.time) / span
  const eased =
    k0.interpolation === "stepped" ||
    track.kind === "boolean" ||
    track.kind === "enum"
      ? 0
      : applyEasing(raw, k0.easing)

  let result: any = k0.value

  switch (track.kind) {
    case "boolean":
    case "enum": {
      result = k0.value
      break
    }
    case "angle": {
      const a0 = Number(k0.value as any)
      const a1 = Number(k1.value as any)
      result = angleLerpDeg(a0, a1, eased)
      break
    }
    case "color": {
      const c0 = (k0.value as unknown as number[]).slice(0, 4)
      const c1 = (k1.value as unknown as number[]).slice(0, 4)
      const l0 = [
        srgbToLinear(c0[0]),
        srgbToLinear(c0[1]),
        srgbToLinear(c0[2]),
        c0[3],
      ]
      const l1 = [
        srgbToLinear(c1[0]),
        srgbToLinear(c1[1]),
        srgbToLinear(c1[2]),
        c1[3],
      ]
      const l = [
        lerp(l0[0], l1[0], eased),
        lerp(l0[1], l1[1], eased),
        lerp(l0[2], l1[2], eased),
        lerp(l0[3], l1[3], eased),
      ]
      result = [
        linearToSrgb(l[0]),
        linearToSrgb(l[1]),
        linearToSrgb(l[2]),
        l[3],
      ]
      break
    }
    case "vec2":
    case "vec3":
    case "vec4": {
      const a0 = k0.value as unknown as number[]
      const a1 = k1.value as unknown as number[]
      const out: number[] = []
      const n = Math.max(a0.length, a1.length)
      for (let i = 0; i < n; i++)
        out.push(lerp(Number(a0[i] ?? 0), Number(a1[i] ?? 0), eased))
      result = out
      break
    }
    case "object": {
      // Shallow-field linear interpolation for numeric fields when possible; otherwise stepped
      const v0 = k0.value as any
      const v1 = k1.value as any
      const out: any = {}
      for (const key of new Set([
        ...Object.keys(v0 || {}),
        ...Object.keys(v1 || {}),
      ])) {
        const a = v0?.[key]
        const b = v1?.[key]
        if (typeof a === "number" && typeof b === "number")
          out[key] = lerp(a, b, eased)
        else out[key] = v0?.[key]
      }
      result = out
      break
    }
    case "percent":
    case "scalar":
    default: {
      const a = Number(k0.value as any)
      const b = Number(k1.value as any)
      result = lerp(a, b, eased)
      break
    }
  }

  const clamped = clampToDomain<T>(result, track.min, track.max)
  sampleCache.set(ck, clamped)
  return clamped
}

export function clearSamplingCache(): void {
  sampleCache.clear()
}

// Track editing helpers
export function upsertKeyframe<T>(
  track: Track<T>,
  time: number,
  value: T,
  opts?: { easing?: EasingType; interpolation?: InterpolationType }
): Track<T> {
  const kfs = track.keyframes.slice().sort((a, b) => a.time - b.time)
  // If keyframe at exact time, replace
  const idx = kfs.findIndex((k) => Math.abs(k.time - time) < 1e-6)
  const kf: Keyframe<T> = {
    time,
    value,
    easing: opts?.easing ?? kfs[idx]?.easing ?? "linear",
    interpolation:
      opts?.interpolation ??
      kfs[idx]?.interpolation ??
      (track.kind === "boolean" || track.kind === "enum"
        ? "stepped"
        : "linear"),
  }
  if (idx >= 0) kfs[idx] = kf
  else {
    kfs.push(kf)
    kfs.sort((a, b) => a.time - b.time)
  }
  return { ...track, keyframes: kfs }
}

export function deleteKeyframe<T>(track: Track<T>, time: number): Track<T> {
  const kfs = track.keyframes.filter((k) => Math.abs(k.time - time) >= 1e-6)
  // Ensure at least one keyframe at t=0 remains
  if (kfs.length === 0) {
    const fallback: Keyframe<T> = {
      time: 0,
      value: track.keyframes[0]?.value as T,
      easing: "linear",
      interpolation:
        track.kind === "boolean" || track.kind === "enum"
          ? "stepped"
          : "linear",
    }
    return { ...track, keyframes: [fallback] }
  }
  return { ...track, keyframes: kfs }
}

export function createTrack<T>(
  paramId: string,
  kind: ParamKind,
  defaultValue: T,
  domain?: { min?: any; max?: any }
): Track<T> {
  return {
    id: `${paramId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    paramId,
    kind,
    keyframes: [
      {
        time: 0,
        value: defaultValue,
        easing: kind === "boolean" || kind === "enum" ? undefined : "linear",
        interpolation:
          kind === "boolean" || kind === "enum" ? "stepped" : "linear",
      },
    ],
    min: domain?.min,
    max: domain?.max,
  }
}
