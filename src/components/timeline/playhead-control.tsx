"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useEditorContext } from "@/lib/editor/context"
import { cn } from "@/lib/utils"

export function PlayheadControl({
  duration,
  currentTime,
  className,
}: {
  duration: number
  currentTime: number
  className?: string
}) {
  const { setPlayheadTime, setScrubbing } = useEditorContext()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const clampedTime = useMemo(() => {
    if (!Number.isFinite(currentTime)) return 0
    if (currentTime < 0) return 0
    if (currentTime > duration) return duration
    return currentTime
  }, [currentTime, duration])

  const pct = useMemo(() => {
    return duration > 0 ? (clampedTime / duration) * 100 : 0
  }, [clampedTime, duration])

  const setTimeFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const t = duration > 0 ? (x / rect.width) * duration : 0
      setPlayheadTime(t)
    },
    [duration, setPlayheadTime]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      setIsDragging(true)
      setScrubbing(true)
      setTimeFromClientX(e.clientX)
    },
    [setTimeFromClientX, setScrubbing]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      setTimeFromClientX(e.clientX)
    },
    [isDragging, setTimeFromClientX]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsDragging(false)
      setScrubbing(false)
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [setScrubbing]
  )

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={trackRef}
        className={cn(
          "relative h-8 rounded-sm border bg-white/60 dark:bg-black/30 overflow-hidden",
          "cursor-pointer"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label='Timeline playhead track'
        role='slider'
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={clampedTime}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault()
            const step = Math.max(1 / 60, duration / 200)
            const delta = e.key === "ArrowRight" ? step : -step
            const next = Math.min(duration, Math.max(0, clampedTime + delta))
            setPlayheadTime(next)
          }
        }}
      >
        <div
          className='absolute top-0 bottom-0 bg-blue-500/20 pointer-events-none'
          style={{ width: `${pct}%` }}
        />
        <div
          className='absolute top-0 bottom-0 w-0.5 bg-blue-500 pointer-events-none'
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}
