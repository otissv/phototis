import { TOOL_VALUES } from "@/lib/tools/tools"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import type { Track, ParamKind } from "@/lib/animation/timeline"
import { createTrack, sampleTrack } from "@/lib/animation/timeline"

export type ImageEditorToolsTracks = Record<string, Track<any>>

function inferKind(key: string): ParamKind {
  if (key === "flipHorizontal" || key === "flipVertical") return "boolean"
  if (key === "rotate") return "angle"
  if (key === "scale" || key === "zoom") return "scalar"
  if (key === "dimensions") return "object"
  if (key === "crop") return "object"
  if (key.toLowerCase().includes("color")) return "color"
  return "scalar"
}

export function createDefaultToolTracks(): ImageEditorToolsTracks {
  const tracks: ImageEditorToolsTracks = {}
  for (const [key, def] of Object.entries(TOOL_VALUES as Record<string, any>)) {
    const kind = inferKind(key)
    const min = def && typeof def.min !== "undefined" ? def.min : undefined
    const max = def && typeof def.max !== "undefined" ? def.max : undefined
    const defaultValue =
      def?.defaultValue ??
      (kind === "boolean" ? false : kind === "object" ? {} : 0)
    tracks[key] = createTrack(key, kind, defaultValue, { min, max })
  }
  return tracks
}

export function sampleToolsAtTime(
  tracks: ImageEditorToolsTracks,
  t: number
): ImageEditorToolsState {
  const out: Record<string, any> = {}
  for (const [key, tr] of Object.entries(tracks)) {
    out[key] = sampleTrack(tr as Track<any>, t)
  }
  return out as ImageEditorToolsState
}

export function upsertToolKeyframes(
  tracks: ImageEditorToolsTracks,
  t: number,
  updates: Record<string, any>
): ImageEditorToolsTracks {
  const next: ImageEditorToolsTracks = { ...tracks }
  for (const [key, value] of Object.entries(updates)) {
    const tr = next[key]
    if (!tr) continue
    // Preserve kind/domain
    const updated = createTrack(tr.paramId, tr.kind, sampleTrack(tr, 0), {
      min: tr.min,
      max: tr.max,
    })
    // Replace with original keyframes then upsert
    ;(updated as any).keyframes = (tr as any).keyframes.slice()
    const { upsertKeyframe } = require("@/lib/animation/timeline")
    next[key] = upsertKeyframe(updated, t, value)
  }
  return next
}

export function createTracksFromParams(
  params: Record<string, any>
): Record<string, Track<any>> {
  const out: Record<string, Track<any>> = {}
  for (const [key, value] of Object.entries(params)) {
    let kind: ParamKind = "scalar"
    if (typeof value === "boolean") kind = "boolean"
    else if (typeof value === "number")
      kind = key === "hue" || key === "rotate" ? "angle" : "scalar"
    else if (value && typeof value === "object") {
      const hasColor = {}.hasOwnProperty.call(value, "color")
      const hasValue = {}.hasOwnProperty.call(value, "value")
      if (hasColor && hasValue) {
        kind = "color"
      } else if (Array.isArray(value)) {
        const n = value.length
        kind = n === 2 ? "vec2" : n === 3 ? "vec3" : n === 4 ? "vec4" : "object"
      } else {
        kind = "object"
      }
    }
    out[key] = createTrack(key, kind, value)
  }
  return out
}
