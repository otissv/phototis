import type { Track, ParamKind, Keyframe } from "@/lib/animation/model"
// no-op: canonical helpers are pure and sort locally

export function isCanonicalTrack(value: unknown): value is Track<any> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as any).keyframes)
  )
}

export function createCanonicalTrack<T = any>(
  paramId: string,
  initialValue: T,
  kind?: ParamKind
): Track<T> {
  const k = kind ?? inferKind(initialValue)
  return {
    id: paramId,
    owner: { type: "layer", id: "unknown" },
    paramId,
    kind: k,
    domain: defaultDomain(k),
    keyframes: [{ timeSec: 0, value: initialValue } as Keyframe<T>],
    defaultEasing: "linear",
    interpolation: "linear",
  }
}

export function addOrUpdateKeyframeCanonical<T = any>(
  track: Track<T>,
  timeSec: number,
  value: T
): Track<T> {
  const keyframes = [...track.keyframes]
  const idx = keyframes.findIndex((k) => k.timeSec === timeSec)
  if (idx >= 0) keyframes[idx] = { ...keyframes[idx], timeSec, value }
  else {
    keyframes.push({ timeSec, value })
    keyframes.sort((a, b) => a.timeSec - b.timeSec)
  }
  return { ...track, keyframes }
}

export function moveKeyframeCanonical<T = any>(
  track: Track<T>,
  fromTimeSec: number,
  toTimeSec: number
): Track<T> {
  const idx = track.keyframes.findIndex((k) => k.timeSec === fromTimeSec)
  if (idx === -1) return track
  const kf = track.keyframes[idx]
  const keyframes = [...track.keyframes]
  keyframes.splice(idx, 1)
  keyframes.push({ ...kf, timeSec: Math.max(0, toTimeSec) })
  keyframes.sort((a, b) => a.timeSec - b.timeSec)
  return { ...track, keyframes }
}

export function removeKeyframeCanonical<T = any>(
  track: Track<T>,
  timeSec: number
): Track<T> {
  const keyframes = track.keyframes.filter((k) => k.timeSec !== timeSec)
  if (keyframes.length === 0)
    keyframes.push({ timeSec: 0, value: track.keyframes[0]?.value as T })
  return { ...track, keyframes }
}

export function setInterpolationCanonical<T = any>(
  track: Track<T>,
  interpolation: Track<T>["interpolation"]
): Track<T> {
  return { ...track, interpolation }
}

export function setBezierEasingAllCanonical<T = any>(
  track: Track<T>,
  bezier: { x1: number; y1: number; x2: number; y2: number }
): Track<T> {
  const keyframes = (track.keyframes || []).map((k) => ({
    ...k,
    easing: {
      type: "bezier",
      cx1: bezier.x1,
      cy1: bezier.y1,
      cx2: bezier.x2,
      cy2: bezier.y2,
    },
  }))
  return { ...track, keyframes }
}

function inferKind(v: unknown): ParamKind {
  if (typeof v === "number") return "scalar"
  if (typeof v === "boolean") return "boolean"
  if (Array.isArray(v)) {
    if (v.length === 2) return "vec2"
    if (v.length === 3) return "vec3"
    if (v.length === 4) return "vec4"
  }
  return "scalar"
}

function defaultDomain(kind: ParamKind): any {
  switch (kind) {
    case "scalar":
    case "percentage":
      return {
        kind: "range",
        min: Number.NEGATIVE_INFINITY,
        max: Number.POSITIVE_INFINITY,
      }
    case "boolean":
      return { kind: "boolean" }
    case "enum":
      return { kind: "enum", values: [] }
    case "angle":
      return { kind: "angle", normalize: true }
    case "color":
      return { kind: "color" }
    case "vec2":
    case "vec3":
    case "vec4":
      return {
        kind: "range",
        min: Number.NEGATIVE_INFINITY,
        max: Number.POSITIVE_INFINITY,
      }
  }
}
