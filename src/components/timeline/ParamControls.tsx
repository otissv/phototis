"use client"

import React from "react"
import { GlobalKeyframePluginRegistry } from "@/lib/animation/plugins"

export function ParamControls({
  paramId,
  value,
  onChange,
}: {
  paramId: string
  value: any
  onChange: (next: any) => void
}) {
  const meta = React.useMemo(() => {
    try {
      return GlobalKeyframePluginRegistry.getMetadata(paramId)
    } catch {
      return null
    }
  }, [paramId])

  if (!meta) return null

  const ui = meta.ui as any
  switch (ui.type) {
    case "slider":
      return (
        <label className='flex items-center gap-2 text-xs'>
          <span className='w-24 truncate'>{ui.label}</span>
          <input
            type='range'
            min={ui.min}
            max={ui.max}
            step={ui.step ?? 1}
            value={Number(value) || 0}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={ui.label}
          />
        </label>
      )
    case "toggle":
      return (
        <label className='flex items-center gap-2 text-xs'>
          <input
            type='checkbox'
            checked={Boolean(value)}
            onChange={(e) => onChange(Boolean(e.target.checked))}
            aria-label={ui.label}
          />
          <span>{ui.label}</span>
        </label>
      )
    case "select":
      return (
        <label className='flex items-center gap-2 text-xs'>
          <span className='w-24 truncate'>{ui.label}</span>
          <select
            className='border rounded px-1 py-0.5 text-xs'
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ui.label}
          >
            {(ui.options || []).map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )
    case "color":
      return (
        <label className='flex items-center gap-2 text-xs'>
          <span className='w-24 truncate'>{ui.label}</span>
          <input
            type='color'
            value={String(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ui.label}
          />
        </label>
      )
    default:
      return null
  }
}
