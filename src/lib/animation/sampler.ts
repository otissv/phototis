import type { Track, ParamKind, Keyframe, DomainConstraint } from "./model"
import {
  applyEasing,
  clampPercentage,
  normalizeAngleRad,
  sortKeyframesInPlace,
} from "./model"
import { clamp01, linearRgbaToSrgb, srgbRgbaToLinear } from "./color"
import { LruCache, makeKey, toTimeBucket } from "./memo"

export type ParamRef<T = unknown> = {
  track: Track<T>
  layerId: string
  toolId: string
  paramId: string
  revision: number
}

const DEFAULT_CACHE_SIZE = 20_000
const cache = new LruCache<any>(DEFAULT_CACHE_SIZE)

// Public API: pure sampling function with memoization per time bucket
export function sample<T>(ref: ParamRef<T>, timeSec: number): T {
  const bucket = toTimeBucket(timeSec)
  const key = makeKey({
    layerId: ref.layerId,
    toolId: ref.toolId,
    paramId: ref.paramId,
    tBucket: bucket,
    revision: ref.revision,
  })
  const cached = cache.get(key)
  if (cached !== undefined) return cached as T
  const v = evaluateTrack(ref.track, timeSec)
  cache.set(key, v)
  return v
}

export function invalidateForTrack(
  layerId: string,
  toolId: string,
  paramId: string
): void {
  cache.invalidate((k) => k.startsWith(`${layerId}|${toolId}|${paramId}|`))
}

export function invalidateAll(): void {
  cache.clear()
}

// O(log n) neighbor search via binary search on sorted keyframes
function neighborSearch<T>(
  track: Track<T>,
  t: number
): {
  k0: Keyframe<T>
  k1: Keyframe<T>
  segmentT: number
} {
  const keys = track.keyframes
  sortKeyframesInPlace(track)
  const n = keys.length
  if (n === 0) throw new Error("Track has no keyframes")
  if (t <= keys[0].timeSec) return { k0: keys[0], k1: keys[0], segmentT: 0 }
  if (t >= keys[n - 1].timeSec)
    return { k0: keys[n - 1], k1: keys[n - 1], segmentT: 1 }
  let lo = 0
  let hi = n - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const mt = keys[mid].timeSec
    if (mt === t) {
      return { k0: keys[mid], k1: keys[mid], segmentT: 0 }
    }
    if (mt < t) lo = mid + 1
    else hi = mid - 1
  }
  const i1 = Math.max(1, lo)
  const i0 = i1 - 1
  const a = keys[i0]
  const b = keys[i1]
  const dt = b.timeSec - a.timeSec
  const u = dt > 0 ? (t - a.timeSec) / dt : 0
  // Easing uses next keyframe's easing or default
  const easing = b.easing ?? track.defaultEasing ?? "linear"
  const w = applyEasing(u, easing)
  return { k0: a, k1: b, segmentT: clamp01(w) }
}

function evaluateTrack<T>(track: Track<T>, timeSec: number): any {
  switch (track.kind as ParamKind) {
    case "scalar":
      return clampToDomain(track.domain, evalScalar(track as any, timeSec))
    case "percentage":
      return clampPercentage(evalScalar(track as any, timeSec))
    case "angle":
      return clampToDomain(track.domain, evalAngle(track as any, timeSec))
    case "boolean":
      return evalStepped(track as any, timeSec)
    case "enum":
      return evalStepped(track as any, timeSec)
    case "vec2":
    case "vec3":
    case "vec4":
      return clampVectorToDomain(
        track.domain,
        evalVector(track as any, timeSec)
      )
    case "color":
      return evalColor(track as any, timeSec)
    default:
      throw new Error(`Unsupported track kind ${(track as any).kind}`)
  }
}

function evalScalar(track: Track<number>, t: number): number {
  const { k0, k1, segmentT } = neighborSearch(track, t)
  if (track.interpolation === "step") return k0.value
  return k0.value + (k1.value - k0.value) * segmentT
}

function evalVector(track: Track<number[]>, t: number): number[] {
  const { k0, k1, segmentT } = neighborSearch(track, t)
  if (track.interpolation === "step") return k0.value.slice()
  const a = k0.value
  const b = k1.value
  const out = new Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * segmentT
  return out
}

function evalColor(track: Track<[number, number, number, number]>, t: number) {
  const { k0, k1, segmentT } = neighborSearch(track, t)
  // Inputs are linear floats per model contract; interpolate linearly in linear space
  const a = k0.value
  const b = k1.value
  const out: [number, number, number, number] = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) out[i] = clamp01(a[i] + (b[i] - a[i]) * segmentT)
  return out
}

function evalAngle(track: Track<number>, t: number): number {
  const { k0, k1, segmentT } = neighborSearch(track, t)
  if (track.interpolation === "step") return k0.value
  const delta = normalizeAngleRad(k1.value - k0.value)
  return k0.value + delta * segmentT
}

function evalStepped<T>(track: Track<T>, t: number): T {
  const keys = track.keyframes
  sortKeyframesInPlace(track)
  // Find last keyframe <= t (binary search)
  let lo = 0
  let hi = keys.length - 1
  let idx = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (keys[mid].timeSec <= t) {
      idx = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return keys[idx].value
}

function clampToDomain(domain: DomainConstraint, v: number): number {
  if (!domain) return v
  if ((domain as any).kind === "range") {
    const d = domain as any
    const min = Number.isFinite(d.min) ? d.min : Number.NEGATIVE_INFINITY
    const max = Number.isFinite(d.max) ? d.max : Number.POSITIVE_INFINITY
    return Math.max(min, Math.min(max, v))
  }
  if ((domain as any).kind === "angle") {
    return normalizeAngleRad(v)
  }
  return v
}

function clampVectorToDomain(domain: DomainConstraint, v: number[]): number[] {
  if (!domain) return v
  if ((domain as any).kind === "range") {
    const d = domain as any
    const min = Number.isFinite(d.min) ? d.min : Number.NEGATIVE_INFINITY
    const max = Number.isFinite(d.max) ? d.max : Number.POSITIVE_INFINITY
    return v.map((x) => Math.max(min, Math.min(max, x)))
  }
  return v
}
