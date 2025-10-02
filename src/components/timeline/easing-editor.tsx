"use client"

import React from "react"
import { cn } from "@/lib/utils"

export type Bezier = { x1: number; y1: number; x2: number; y2: number }

export function EasingEditor({
  value,
  onChange,
  className,
}: {
  value: Bezier
  onChange: (v: Bezier) => void
  className?: string
}) {
  const [local, setLocal] = React.useState<Bezier>(value)
  React.useEffect(() => setLocal(value), [value])

  const update = (patch: Partial<Bezier>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    onChange(next)
  }

  const groupId = React.useId()
  return (
    <fieldset
      className={cn("flex items-center gap-2", className)}
      aria-labelledby={groupId}
    >
      <legend id={groupId} className='text-xs opacity-70'>
        Bezier
      </legend>
      {(["x1", "y1", "x2", "y2"] as const).map((k) => (
        <input
          key={k}
          type='number'
          step={0.01}
          min={0}
          max={1}
          value={(local as any)[k]}
          onChange={(e) => update({ [k]: Number(e.target.value) } as any)}
          className='w-14 border rounded px-1 py-0.5 text-xs bg-transparent'
          aria-label={`cubic-bezier ${k}`}
        />
      ))}
      {/* Placeholder miniature SVG curve preview */}
      <svg
        width='64'
        height='32'
        viewBox='0 0 1 1'
        className='border rounded'
        role='img'
        aria-label='Bezier preview'
      >
        <path
          d={`M0,1 C ${local.x1},${1 - local.y1} ${local.x2},${1 - local.y2} 1,0`}
          stroke='currentColor'
          strokeWidth={0.02}
          fill='none'
        />
      </svg>
    </fieldset>
  )
}
