"use client"

import { cn } from "@/lib/utils"

function formatTimeSecondsToSMPTE(seconds: number, fps: number): string {
  const totalFrames = Math.max(0, Math.floor(seconds * fps))
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const s = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const m = totalMinutes % 60
  const h = Math.floor(totalMinutes / 60)
  const pad2 = (n: number) => String(n).padStart(2, "0")
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}:${pad2(frames)}`
}

export function TimeDisplay({
  currentTime,
  duration,
  fps,
  className,
}: {
  currentTime: number
  duration: number
  fps: number
  className?: string
}) {
  const now = formatTimeSecondsToSMPTE(currentTime, fps)
  const dur = formatTimeSecondsToSMPTE(duration, fps)
  return (
    <div
      className={cn("text-xs tabular-nums px-2 py-1 rounded border", className)}
      aria-live='polite'
    >
      {now} / {dur}
    </div>
  )
}
