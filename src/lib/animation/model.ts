/*
  Canonical Animation Data Model
  - Timeline: duration/timebase/tracks
  - Track<T>: keyframes with interpolation/easing and domain validation
  - Keyframe<T>: time/value with easing/interp metadata

  Invariants:
  - Keyframes sorted ascending by timeSec
  - First keyframe at t=0 seeds from prior static default
  - Deleting down to one keyframe leaves it at t=0

  Serialization contract:
  - Deterministic JSON with version stamp
  - Color as linear floats [0..1]
  - Angles normalized to ±PI on storage
  - Boolean/enum as discrete values
  - Round-trip safe for history/autosave/worker comms
*/

export const ANIMATION_SCHEMA_VERSION = "1.0.0"

export type Fps = {
  fps: number
  dropFrame: boolean
}

export type ParamKind =
  | "scalar"
  | "vec2"
  | "vec3"
  | "vec4"
  | "boolean"
  | "enum"
  | "color"
  | "angle"
  | "percentage"

export type InterpolationType =
  | "linear"
  | "bezier"
  | "step"
  | "catmullRom"
  | "slerp" // spherical for angles

export type EasingType =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | { type: "bezier"; cx1: number; cy1: number; cx2: number; cy2: number }

export type ColorRGBA = [number, number, number, number] // linear floats 0..1

export type Scalar = number
export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type Keyframe<T> = {
  timeSec: number
  value: T
  easing?: EasingType
  interpolation?: InterpolationType
  // Optional cubic bezier control points for custom easing
  bezier?: { x1: number; y1: number; x2: number; y2: number }
  // Optional tangents/handles when using bezier/catmullRom
  inTangent?: Vec2 | Vec3 | Vec4
  outTangent?: Vec2 | Vec3 | Vec4
}

export type TrackOwner =
  | { type: "layer"; id: string }
  | { type: "tool"; id: string }
  | { type: "global"; id: "document" }

export type DomainConstraint =
  | { kind: "range"; min: number; max: number; clamp?: boolean }
  | { kind: "enum"; values: string[] }
  | { kind: "boolean" }
  | { kind: "color" }
  | { kind: "angle"; normalize?: boolean }

export type Track<T> = {
  id: string
  owner: TrackOwner
  paramId: string
  kind: ParamKind
  domain: DomainConstraint
  keyframes: Keyframe<T>[]
  defaultEasing?: EasingType
  interpolation: InterpolationType
  /** Optional expression binding evaluated before modulators */
  expression?: {
    id: string
    params: Record<string, unknown>
  } | null
  /** Optional modulators applied after expression */
  modulators?: Array<{
    id: string
    params: Record<string, unknown>
  }>
}

export type Timeline = {
  version: string
  durationSec: number
  timebase: Fps
  tracks: Track<any>[]
}

export function sortKeyframesInPlace<T>(track: Track<T>): void {
  track.keyframes.sort((a, b) => a.timeSec - b.timeSec)
}

export function ensureTrackInvariants<T>(
  track: Track<T>,
  seedAtZero: () => T
): void {
  // Ensure sorted
  sortKeyframesInPlace(track)
  // Ensure first at t=0
  if (track.keyframes.length === 0) {
    track.keyframes.push({ timeSec: 0, value: seedAtZero() })
  } else if (track.keyframes[0].timeSec !== 0) {
    track.keyframes.unshift({ timeSec: 0, value: track.keyframes[0].value })
  }
  // Single keyframe must be at t=0
  if (track.keyframes.length === 1) {
    track.keyframes[0].timeSec = 0
  }
}

export function clampPercentage(v: number): number {
  return Math.max(0, Math.min(100, v))
}

export function normalizeAngleRad(delta: number): number {
  // Normalize to ±PI
  const PI = Math.PI
  let a = delta
  while (a <= -PI) a += 2 * PI
  while (a > PI) a -= 2 * PI
  return a
}

export function toLinearColor(color: ColorRGBA): ColorRGBA {
  // Assume input already linear; callers must convert from sRGB before calling
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  return [
    clamp01(color[0]),
    clamp01(color[1]),
    clamp01(color[2]),
    clamp01(color[3]),
  ]
}

export type EvaluateContext = {
  timeSec: number
}

export function sampleTrackScalar(track: Track<number>, t: number): number {
  if (track.keyframes.length === 0) return 0
  sortKeyframesInPlace(track)
  const keys = track.keyframes
  if (t <= keys[0].timeSec) return keys[0].value
  if (t >= keys[keys.length - 1].timeSec) return keys[keys.length - 1].value
  let i = 0
  for (; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.timeSec && t <= b.timeSec) {
      const dt = b.timeSec - a.timeSec
      const u = dt > 0 ? (t - a.timeSec) / dt : 0
      const easing = b.easing ?? track.defaultEasing ?? "linear"
      const w = applyEasing(u, easing)
      const interp = b.interpolation ?? track.interpolation
      if (interp === "step") return a.value
      return a.value + (b.value - a.value) * w
    }
  }
  return keys[keys.length - 1].value
}

export function sampleTrackAngle(track: Track<number>, t: number): number {
  if (track.keyframes.length === 0) return 0
  sortKeyframesInPlace(track)
  const keys = track.keyframes
  if (t <= keys[0].timeSec) return keys[0].value
  if (t >= keys[keys.length - 1].timeSec) return keys[keys.length - 1].value
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.timeSec && t <= b.timeSec) {
      const dt = b.timeSec - a.timeSec
      const u = dt > 0 ? (t - a.timeSec) / dt : 0
      const w = applyEasing(u, b.easing ?? track.defaultEasing ?? "linear")
      const da = normalizeAngleRad(b.value - a.value)
      return a.value + da * w
    }
  }
  return keys[keys.length - 1].value
}

export function sampleTrackBoolean(track: Track<boolean>, t: number): boolean {
  if (track.keyframes.length === 0) return false
  sortKeyframesInPlace(track)
  const keys = track.keyframes
  // stepped
  for (let i = keys.length - 1; i >= 0; i--) {
    if (t >= keys[i].timeSec) return keys[i].value
  }
  return keys[0].value
}

export function sampleTrackEnum(track: Track<string>, t: number): string {
  if (track.keyframes.length === 0) return ""
  sortKeyframesInPlace(track)
  const keys = track.keyframes
  for (let i = keys.length - 1; i >= 0; i--) {
    if (t >= keys[i].timeSec) return keys[i].value
  }
  return keys[0].value
}

export function sampleTrackVec(
  track: Track<Vec2 | Vec3 | Vec4>,
  t: number
): Vec2 | Vec3 | Vec4 {
  const keys = track.keyframes
  if (keys.length === 0) return [0, 0] as Vec2
  const a = sampleNeighborKeyframes(track, t)
  if (!a) return keys[0].value
  const { k0, k1, w } = a
  const v0 = k0.value as any
  const v1 = k1.value as any
  const n = (v0 as number[]).length
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = v0[i] + (v1[i] - v0[i]) * w
  return out as any
}

function sampleNeighborKeyframes<T>(
  track: Track<T>,
  t: number
): { k0: Keyframe<T>; k1: Keyframe<T>; w: number } | null {
  sortKeyframesInPlace(track)
  const keys = track.keyframes
  if (t <= keys[0].timeSec) return { k0: keys[0], k1: keys[0], w: 0 }
  if (t >= keys[keys.length - 1].timeSec)
    return { k0: keys[keys.length - 1], k1: keys[keys.length - 1], w: 1 }
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i]
    const k1 = keys[i + 1]
    if (t >= k0.timeSec && t <= k1.timeSec) {
      const dt = k1.timeSec - k0.timeSec
      const u = dt > 0 ? (t - k0.timeSec) / dt : 0
      const easing = k1.easing ?? track.defaultEasing ?? "linear"
      const w = applyEasing(u, easing)
      return { k0, k1, w }
    }
  }
  return null
}

export function applyEasing(u: number, easing: EasingType): number {
  const x = Math.max(0, Math.min(1, u))
  if (typeof easing === "object" && easing.type === "bezier") {
    // Cubic bezier; approximate using De Casteljau at t=x
    const { cx1, cy1, cx2, cy2 } = easing
    return cubicBezierY(x, cx1, cy1, cx2, cy2)
  }
  switch (easing) {
    case "linear":
      return x
    case "easeIn":
      return x * x
    case "easeOut":
      return 1 - (1 - x) * (1 - x)
    case "easeInOut":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
    default:
      return x
  }
}

function cubicBezierY(
  t: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number
): number {
  // Solve parameter by Newton-Raphson on x; use t as initial guess
  const epsilon = 1e-4
  let u = t
  for (let i = 0; i < 5; i++) {
    const xVal = bezier3(u, 0, cx1, cx2, 1)
    const dx = bezier3Deriv(u, 0, cx1, cx2, 1)
    const diff = xVal - t
    if (Math.abs(diff) < epsilon || dx === 0) break
    u -= diff / dx
    u = Math.max(0, Math.min(1, u))
  }
  return bezier3(u, 0, cy1, cy2, 1)
}

function bezier3(
  u: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const v = 1 - u
  return (
    v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3
  )
}

function bezier3Deriv(
  u: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const v = 1 - u
  return (
    -3 * v * v * p0 +
    (3 * v * v - 6 * v * u) * p1 +
    (6 * v * u - 3 * u * u) * p2 +
    3 * u * u * p3
  )
}

// Deterministic serialization helpers
export type SerializableTimeline = {
  version: string
  durationSec: number
  timebase: Fps
  tracks: Array<{
    id: string
    owner: TrackOwner
    paramId: string
    kind: ParamKind
    domain: DomainConstraint
    interpolation: InterpolationType
    defaultEasing?: EasingType
    expression?: { id: string; params: Record<string, unknown> } | null
    modulators?: Array<{ id: string; params: Record<string, unknown> }>
    keyframes: Array<{
      timeSec: number
      value: any
      easing?: EasingType
      interpolation?: InterpolationType
    }>
  }>
}

export function serializeTimeline(tl: Timeline): SerializableTimeline {
  return {
    version: ANIMATION_SCHEMA_VERSION,
    durationSec: tl.durationSec,
    timebase: { fps: tl.timebase.fps, dropFrame: !!tl.timebase.dropFrame },
    tracks: tl.tracks
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((tr) => {
        const kfs = [...tr.keyframes]
          .slice()
          .sort((a, b) => a.timeSec - b.timeSec)
          .map((k) => ({
            timeSec: round6(k.timeSec),
            value: normalizeValueForStorage(tr.kind, k.value as any),
            easing: k.easing,
            interpolation: k.interpolation,
          }))
        return {
          id: tr.id,
          owner: tr.owner,
          paramId: tr.paramId,
          kind: tr.kind,
          domain: tr.domain,
          interpolation: tr.interpolation,
          defaultEasing: tr.defaultEasing,
          expression: tr.expression ?? null,
          modulators:
            tr.modulators && tr.modulators.length > 0 ? tr.modulators : [],
          keyframes: kfs,
        }
      }),
  }
}

export function deserializeTimeline(data: SerializableTimeline): Timeline {
  if (!data || typeof data !== "object")
    throw new Error("Invalid timeline JSON")
  if (typeof data.version !== "string") throw new Error("Missing version")
  const durationSec = numberAssert(data.durationSec, "durationSec")
  const timebase: Fps = {
    fps: numberAssert((data.timebase as any)?.fps, "timebase.fps"),
    dropFrame: !!(data.timebase as any)?.dropFrame,
  }
  const tracks = (data.tracks || []).map((tr: any) => {
    const out: Track<any> = {
      id: stringAssert(tr.id, "track.id"),
      owner: tr.owner,
      paramId: stringAssert(tr.paramId, "track.paramId"),
      kind: tr.kind,
      domain: tr.domain,
      keyframes: (tr.keyframes || []).map((k: any) => ({
        timeSec: numberAssert(k.timeSec, "keyframe.timeSec"),
        value: normalizeValueFromStorage(tr.kind, k.value),
        easing: k.easing,
        interpolation: k.interpolation,
      })),
      defaultEasing: tr.defaultEasing,
      interpolation: tr.interpolation,
      expression: tr.expression ?? null,
      modulators: Array.isArray(tr.modulators) ? tr.modulators : [],
    }
    sortKeyframesInPlace(out)
    ensureTrackInvariants(out, () => normalizeSeed(tr.kind))
    return out
  })
  return { version: data.version, durationSec, timebase, tracks }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

function numberAssert(v: any, name: string): number {
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}`)
  return n
}

function stringAssert(v: any, name: string): string {
  if (typeof v !== "string") throw new Error(`Invalid string for ${name}`)
  return v
}

function normalizeSeed(kind: ParamKind): any {
  switch (kind) {
    case "scalar":
    case "angle":
    case "percentage":
      return 0
    case "boolean":
      return false
    case "enum":
      return ""
    case "color":
      return [0, 0, 0, 1] as ColorRGBA
    case "vec2":
      return [0, 0] as Vec2
    case "vec3":
      return [0, 0, 0] as Vec3
    case "vec4":
      return [0, 0, 0, 0] as Vec4
  }
}

function normalizeValueForStorage(kind: ParamKind, v: any): any {
  switch (kind) {
    case "color":
      return toLinearColor(v as ColorRGBA)
    case "angle":
      return normalizeAngleRad(v as number)
    case "percentage":
      return round6(clampPercentage(v as number))
    default:
      return v
  }
}

function normalizeValueFromStorage(kind: ParamKind, v: any): any {
  switch (kind) {
    case "color":
      return toLinearColor(v as ColorRGBA)
    case "angle":
      return normalizeAngleRad(v as number)
    case "percentage":
      return clampPercentage(v as number)
    default:
      return v
  }
}
