"use client"

import React from "react"
import { GlobalKeyframePluginRegistry } from "@/lib/animation/plugins"

export function ParamControls({
  paramId,
  value,
  onChange,
  uiOverride,
  id,
  style,
  thumbColor = "#000000",
}: {
  paramId: string
  style?: React.CSSProperties
  thumbColor?: string
  value: any
  id?: string
  uiOverride?: {
    type: "slider" | "toggle" | "select" | "color"
    label?: string
    min?: number
    max?: number
    step?: number
    options?: Array<{ label: string; value: string }>
    sliderType?: "hue" | "grayscale" | "default"
  }
  onChange: (next: any) => void
}) {
  const meta = React.useMemo(() => {
    try {
      return GlobalKeyframePluginRegistry.getMetadata(paramId)
    } catch {
      return null
    }
  }, [paramId])

  if (!meta && !uiOverride) return null

  const ui = (uiOverride as any) || (meta?.ui as any)

  switch (ui.type) {
    case "slider":
      return (
        <label className='flex items-center h-9 gap-2'>
          {ui.label && (
            <span className='w-24 truncate text-xs'>{ui.label}</span>
          )}

          <input
            id={id}
            type='range'
            min={ui.min}
            max={ui.max}
            step={ui.step ?? 1}
            value={Number(value) || 0}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={ui.label}
            className='h-2 bg-accent rounded-full appearance-none cursor-pointer flex-1 range-thumb'
            style={{
              ["--thumb-color" as any]: thumbColor,
              ...(ui.sliderType === "grayscale"
                ? {
                    background: "linear-gradient(to right, #000000, #ffffff)",
                  }
                : undefined),
              ...(ui.sliderType === "hue"
                ? {
                    background:
                      "linear-gradient(to right, #ff0000 0%, #ffff00 16.66%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.66%, #ff00ff 83.33%, #ff0000 100%)",
                  }
                : undefined),
              ...style,
            }}
          />
          <span className='text-xs block text-right'>{value as number}</span>
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
