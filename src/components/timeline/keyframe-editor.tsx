"use client"

import React from "react"
import { useEditorContext } from "@/lib/editor/context"
import { cn } from "@/lib/utils"
import { InterpolationSelector } from "@/components/timeline/interpolation-selector"
import { EasingEditor } from "@/components/timeline/easing-editor"

type KeyframeEditorProps = {
  className?: string
  duration: number
}

export function KeyframeEditor({ className, duration }: KeyframeEditorProps) {
  const {
    state,
    addKeyframe,
    updateKeyframeTime,
    deleteKeyframe,
    setPlayheadTime,
    updateLayer,
  } = useEditorContext()

  const selectedId = state.canonical.selection.layerIds[0]
  const layer = selectedId
    ? state.canonical.layers.byId[selectedId]
    : state.canonical.layers.byId["document"]

  const filters = (layer as any)?.filters || {}
  // Derive a robust list of keys to display:
  // 1) Prefer modified keys at current time
  // 2) Else show existing track keys on this layer
  // 3) Else fall back to all animatable keys from initial tools state
  const animatableKeys = React.useMemo(() => {
    try {
      const { initialToolsState } = require("@/lib/tools/tools-state") as any
      const { isTrack } = require("@/lib/tools/tools") as any
      return Object.keys(initialToolsState).filter((k) =>
        isTrack((initialToolsState as any)[k])
      )
    } catch {
      return []
    }
  }, [])

  const keys = React.useMemo(() => {
    try {
      const { sampleToolsAtTime } = require("@/lib/tools/tools-state") as any
      const { collectModifiedKeysFromSample, isTrack } =
        require("@/lib/tools/tools") as any
      const sampled = sampleToolsAtTime(filters, state.canonical.playheadTime)
      const modified = collectModifiedKeysFromSample(sampled)
      if (modified.length > 0) return modified
      const layerTrackKeys = Object.keys(filters || {}).filter((k) =>
        isTrack((filters as any)[k])
      )
      if (layerTrackKeys.length > 0) return layerTrackKeys
      return animatableKeys
    } catch {
      return animatableKeys
    }
  }, [filters, state.canonical.playheadTime, animatableKeys])

  // Group keys for better UX and scanning
  const groupedKeys = React.useMemo(() => {
    const makeGroup = (
      name: string,
      match: (k: string) => boolean
    ): { name: string; keys: string[] } => ({ name, keys: keys.filter(match) })
    const isOrient = (k: string) =>
      k === "rotate" ||
      k === "scale" ||
      k === "flipHorizontal" ||
      k === "flipVertical"
    const isCrop = (k: string) => k.startsWith("crop")
    const isDims = (k: string) => k.startsWith("dimensions")
    const colorParams = new Set([
      "brightness",
      "contrast",
      "saturation",
      "exposure",
      "gamma",
      "grayscale",
      "hue",
      "invert",
      "temperature",
      "tint",
      "vibrance",
      "sepia",
      "vintage",
      "colorizeHue",
      "colorizeSaturation",
      "colorizeLightness",
      "colorizeAmount",
      "colorizePreserveLum",
    ])
    const effectParams = new Set([
      "gaussianAmount",
      "gaussianRadius",
      "noiseAmount",
      "noiseSize",
      "sharpenAmount",
      "sharpenRadius",
      "sharpenThreshold",
    ])
    const isColor = (k: string) => colorParams.has(k)
    const isEffect = (k: string) => effectParams.has(k)
    const groups = [
      makeGroup("Orientation", isOrient),
      makeGroup("Crop", isCrop),
      makeGroup("Dimensions", isDims),
      makeGroup("Color", isColor),
      makeGroup("Effects", isEffect),
    ]
    const covered = new Set(groups.flatMap((g) => g.keys))
    const other = keys.filter((k: string) => !covered.has(k))
    if (other.length > 0) groups.push({ name: "Other", keys: other })
    return groups.filter((g) => g.keys.length > 0)
  }, [keys])

  const sampledAtPlayhead = React.useMemo(() => {
    try {
      const { sampleToolsAtTime } = require("@/lib/tools/tools-state") as any
      return sampleToolsAtTime(filters, state.canonical.playheadTime)
    } catch {
      return {}
    }
  }, [filters, state.canonical.playheadTime])

  const containerRef = React.useRef<HTMLDivElement | null>(null)

  function getTrack(paramKey: string): any | null {
    const t = (filters as any)[paramKey]
    return t && Array.isArray((t as any).keyframes) ? (t as any) : null
  }

  function setTrack(paramKey: string, nextTrack: any) {
    updateLayer(
      (layer as any).id as any,
      {
        filters: { ...(filters as any), [paramKey]: nextTrack },
      } as any
    )
  }

  function onChangeInterpolation(
    paramKey: string,
    value:
      | "linear"
      | "stepped"
      | "easeIn"
      | "easeOut"
      | "easeInOut"
      | "cubicBezier"
      | "catmullRom"
      | "slerp"
  ) {
    const tr = getTrack(paramKey)
    if (!tr) return
    try {
      const { setInterpolationCanonical } =
        require("@/lib/animation/crud") as any
      const next = setInterpolationCanonical(
        tr,
        value === "stepped"
          ? ("step" as any)
          : value === "cubicBezier"
            ? ("bezier" as any)
            : value === "catmullRom"
              ? ("catmullRom" as any)
              : value === "slerp"
                ? ("slerp" as any)
                : ("linear" as any)
      )
      setTrack(paramKey, next)
      try {
        const { invalidateForTrack } = require("@/lib/animation/sampler") as any
        invalidateForTrack((layer as any).id, "filters", paramKey)
      } catch {}
    } catch {}
  }

  function onChangeEasingBezier(
    paramKey: string,
    bez: { x1: number; y1: number; x2: number; y2: number }
  ) {
    const tr = getTrack(paramKey)
    if (!tr) return
    try {
      const { setBezierEasingAllCanonical } =
        require("@/lib/animation/crud") as any
      const next = setBezierEasingAllCanonical(tr, bez)
      setTrack(paramKey, next)
      try {
        const { invalidateForTrack } = require("@/lib/animation/sampler") as any
        invalidateForTrack((layer as any).id, "filters", paramKey)
      } catch {}
    } catch {}
  }

  const onAddAtTime = (paramKey: string, t: number) => {
    const track = (filters as any)[paramKey]
    let current: any
    if (
      Array.isArray((track as any)?.keyframes) &&
      (track as any).keyframes.length > 0
    ) {
      current = (track as any).keyframes[(track as any).keyframes.length - 1]
        .value
    } else {
      try {
        const { initialToolsState, sampleToolsAtTime } =
          require("@/lib/tools/tools-state") as any
        const sampledDefaults = sampleToolsAtTime(initialToolsState, t)
        current = (sampledDefaults as any)[paramKey]
      } catch {
        current = 0
      }
    }
    addKeyframe(layer.id as any, paramKey, t, current)
  }

  const onBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const t = duration > 0 ? (x / rect.width) * duration : 0
    setPlayheadTime(t)
  }

  // Simple time ruler ticks (nice steps)
  const ticks = React.useMemo(() => {
    const maxTicks = 10
    if (!Number.isFinite(duration) || duration <= 0) return [] as number[]
    const base = Math.pow(10, Math.floor(Math.log10(duration / maxTicks)))
    const steps = [1, 2, 5]
    let step = base
    for (const s of steps) {
      if (duration / (base * s) <= maxTicks) {
        step = base * s
        break
      }
    }
    const out: number[] = []
    for (let t = 0; t <= duration + 1e-6; t += step)
      out.push(Number(t.toFixed(6)))
    return out
  }, [duration])

  const formatTime = (t: number) => {
    if (!Number.isFinite(t)) return "0:00"
    const minutes = Math.floor(t / 60)
    const seconds = Math.floor(t % 60)
    const ms = Math.floor((t * 1000) % 1000)
    return `${minutes}:${String(seconds).padStart(2, "0")}${duration < 10 ? `.${String(ms).padStart(3, "0").slice(0, 2)}` : ""}`
  }

  return (
    <div
      className={cn(
        "border rounded-sm bg-white/60 dark:bg-black/30 p-2",
        className
      )}
    >
      <div className='text-xs font-medium uppercase tracking-wide opacity-70 mb-1'>
        Keyframes
      </div>
      {/* Top time ruler above rows */}
      <div className='relative h-6 border rounded-sm bg-white/50 dark:bg-black/20 overflow-hidden'>
        <div className='absolute inset-0'>
          {ticks.map((t) => {
            const left = duration > 0 ? (t / duration) * 100 : 0
            return (
              <div
                key={`tick-${t}`}
                className='absolute top-0 bottom-0'
                style={{ left: `${left}%` }}
              >
                <div className='w-px h-full bg-black/20 dark:bg-white/20' />
                <div className='absolute top-0 left-1 text-[10px] opacity-70 select-none'>
                  {formatTime(t)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <section
        ref={containerRef}
        className='relative h-40 overflow-hidden border rounded-sm bg-white/50 dark:bg-black/20'
        onDoubleClick={onBackgroundClick}
        aria-label='Keyframe editor area'
      >
        {/* Grid */}
        <div className='absolute inset-0 pointer-events-none'>
          <div className='h-full w-full [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:20px_100%,100%_20px]' />
        </div>

        {/* Tracks rows with grouping */}
        <div className='relative h-full'>
          {(() => {
            let rowCounter = 0
            const blocks: React.ReactNode[] = []
            const headerHeightRows = 1 // treat header as 1 row for positioning
            const rowHeightPx = 24

            const formatPreview = (v: any): string => {
              if (typeof v === "number") return Number(v).toFixed(2)
              if (typeof v === "boolean") return v ? "1" : "0"
              if (Array.isArray(v))
                return v.map((n) => Number(n).toFixed(2)).join(",")
              return ""
            }

            for (const group of groupedKeys) {
              const headerTop = rowCounter * rowHeightPx
              blocks.push(
                <h3
                  key={`hdr-${group.name}`}
                  className='absolute left-0 right-0 bg-white/70 dark:bg-black/40 text-[11px] font-medium px-2 py-1 border-b border-black/10 dark:border-white/10'
                  style={{ top: headerTop, height: rowHeightPx }}
                >
                  {group.name}
                </h3>
              )
              rowCounter += headerHeightRows

              for (const paramKey of group.keys) {
                const track = (filters as any)[paramKey]
                const rowTop = rowCounter * rowHeightPx
                blocks.push(
                  <div
                    key={paramKey}
                    className='absolute left-0 right-0'
                    style={{ top: rowTop, height: rowHeightPx }}
                    onClick={(e) => {
                      const rowEl = e.currentTarget as HTMLDivElement
                      const rect = rowEl.getBoundingClientRect()
                      const x = Math.max(
                        0,
                        Math.min(rect.width, e.clientX - rect.left)
                      )
                      const t = duration > 0 ? (x / rect.width) * duration : 0
                      onAddAtTime(paramKey, t)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        const rowEl = e.currentTarget as HTMLDivElement
                        const rect = rowEl.getBoundingClientRect()
                        const pct =
                          duration > 0
                            ? state.canonical.playheadTime / duration
                            : 0
                        const x = Math.max(
                          0,
                          Math.min(rect.width, rect.width * pct)
                        )
                        const t = duration > 0 ? (x / rect.width) * duration : 0
                        onAddAtTime(paramKey, t)
                      }
                    }}
                  >
                    <div className='absolute left-0 right-0 top-0 bottom-0 border-b border-black/10 dark:border-white/10' />
                    {/* Row controls (preview, interp, easing) */}
                    <div className='absolute right-2 top-0 h-full flex items-center gap-2 pointer-events-auto'>
                      <span className='text-[11px] opacity-70 min-w-[48px] text-right'>
                        {formatPreview((sampledAtPlayhead as any)[paramKey])}
                      </span>
                      <InterpolationSelector
                        value={(() => {
                          const interp = (track as any)?.interpolation
                          if (interp === "step") return "stepped"
                          if (interp === "bezier") return "cubicBezier"
                          if (interp === "catmullRom") return "catmullRom"
                          if (interp === "slerp") return "slerp"
                          return "linear"
                        })()}
                        onChange={(v) => onChangeInterpolation(paramKey, v)}
                      />
                      <EasingEditor
                        value={(() => {
                          const kf0 =
                            Array.isArray((track as any)?.keyframes) &&
                            (track as any).keyframes.length > 0
                              ? (track as any).keyframes[0]
                              : null
                          const easing = (kf0 as any)?.easing
                          const b =
                            easing &&
                            typeof easing === "object" &&
                            easing.type === "bezier"
                              ? {
                                  x1: easing.cx1,
                                  y1: easing.cy1,
                                  x2: easing.cx2,
                                  y2: easing.cy2,
                                }
                              : undefined
                          return b || { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 }
                        })()}
                        onChange={(b) => onChangeEasingBezier(paramKey, b)}
                      />
                    </div>
                    {/* Keyframe handles - canonical only */}
                    {Array.isArray((track as any)?.keyframes)
                      ? (track as any).keyframes.map((kf: any) => {
                          const leftPct =
                            duration > 0 ? (kf.timeSec / duration) * 100 : 0
                          return (
                            <div key={`${paramKey}-${kf.timeSec}`}>
                              <KeyframeHandle
                                leftPct={leftPct}
                                onDrag={(dxPct) => {
                                  const nextT = Math.max(
                                    0,
                                    Math.min(
                                      duration,
                                      ((leftPct + dxPct) * duration) / 100
                                    )
                                  )
                                  updateKeyframeTime(
                                    (layer as any).id as any,
                                    paramKey,
                                    kf.timeSec,
                                    nextT
                                  )
                                }}
                                onClick={() => {
                                  deleteKeyframe(
                                    (layer as any).id as any,
                                    paramKey,
                                    kf.timeSec
                                  )
                                }}
                              />
                            </div>
                          )
                        })
                      : null}

                    {/* Add at playhead (button) */}
                    <button
                      className='absolute left-2 top-1 text-[11px] px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddAtTime(paramKey, state.canonical.playheadTime)
                      }}
                      type='button'
                      aria-label={`Add keyframe for ${paramKey} at playhead`}
                    >
                      +
                    </button>
                  </div>
                )
                rowCounter += 1
              }
            }
            return blocks
          })()}
        </div>
      </section>
    </div>
  )
}

function KeyframeHandle({
  leftPct,
  onDrag,
  onClick,
}: {
  leftPct: number
  onDrag: (dxPct: number) => void
  onClick: () => void
}) {
  const ref = React.useRef<HTMLButtonElement | null>(null)
  const dragging = React.useRef(false)
  const startX = React.useRef(0)

  return (
    <button
      ref={ref}
      className='absolute top-1/2 -translate-y-1/2 -ml-[5px] w-[10px] h-[10px] rotate-45 bg-blue-500 border border-white shadow cursor-ew-resize'
      style={{ left: `${leftPct}%` }}
      aria-label='Keyframe handle'
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault()
        dragging.current = true
        startX.current = e.clientX
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        const dx = e.clientX - startX.current
        startX.current = e.clientX
        // Translate px to percentage within parent width
        const parent = (ref.current?.parentElement as HTMLElement) ?? null
        if (!parent) return
        const rect = parent.getBoundingClientRect()
        const dxPct = rect.width > 0 ? (dx / rect.width) * 100 : 0
        onDrag(dxPct)
      }}
      onPointerUp={(e) => {
        dragging.current = false
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        } else if (e.key === "ArrowLeft") {
          e.preventDefault()
          onDrag(-1)
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          onDrag(1)
        }
      }}
      type='button'
    />
  )
}
