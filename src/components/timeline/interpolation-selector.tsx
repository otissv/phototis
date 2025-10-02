"use client"

import React from "react"
import { cn } from "@/lib/utils"

export type InterpolationKind =
  | "linear"
  | "stepped"
  | "cubicBezier"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "catmullRom"
  | "slerp"

export function InterpolationSelector({
  value,
  onChange,
  className,
}: {
  value: InterpolationKind
  onChange: (v: InterpolationKind) => void
  className?: string
}) {
  const selectId = React.useId()
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <label htmlFor={selectId} className='text-xs opacity-70'>
        Interp
      </label>
      <select
        id={selectId}
        className='border rounded px-1 py-0.5 text-xs bg-transparent'
        value={value}
        onChange={(e) => onChange(e.target.value as InterpolationKind)}
        aria-label='Interpolation'
      >
        {[
          "linear",
          "stepped",
          "easeIn",
          "easeOut",
          "easeInOut",
          "cubicBezier",
          "catmullRom",
          "slerp",
        ].map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </div>
  )
}
