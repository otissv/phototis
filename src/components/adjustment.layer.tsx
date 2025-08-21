"use client"

import { Eclipse, Palette, Sun, Droplets, Sparkles } from "lucide-react"

import { TOOL_VALUES, type ToolValueColorType } from "@/lib/tools"
import { Color } from "@/components/color"
import { colorPalette } from "@/components/color-palette"
import type { AdjustmentLayer } from "@/lib/editor/state"
import { Toggle } from "@/ui/toggle"
import { ToggleSwitch } from "./toggle-switch"
import { cn } from "@/lib/utils"

// Helper function to get appropriate icon for adjustment types
export function getAdjustmentIcon(adjustmentType: string) {
  switch (adjustmentType) {
    case "brightness":
    case "exposure":
      return <Sun className='w-3 h-3' />
    case "contrast":
    case "gamma":
      return <Palette className='w-3 h-3' />
    case "hue":
    case "saturation":
    case "temperature":
    case "recolor":
      return <Droplets className='w-3 h-3' />
    case "vibrance":
    case "vintage":
      return <Sparkles className='w-3 h-3' />
    case "grayscale":
    case "invert":
    case "sepia":
      return <Eclipse className='w-3 h-3' />
    default:
      return <Palette className='w-3 h-3' />
  }
}

// Adjustment Layer Editor Component
export interface AdjustmentLayerEditorProps {
  layer: AdjustmentLayer
  onUpdate: (
    parameters: Record<string, number | { value: number; color: string }>
  ) => void
}

export function AdjustmentLayerEditor({
  layer,
  onUpdate,
}: AdjustmentLayerEditorProps) {
  const handleParameterChange = (
    key: string,
    value: number | { value: number; color: string }
  ) => {
    // value is hex and we need to be converted to rgb
    onUpdate({ [key]: value })
  }

  const renderParameterControl = (
    key: string,
    value: number | ToolValueColorType["defaultValue"]
  ) => {
    let inputValue: unknown

    switch (key) {
      case "invert":
        return (
          <AdjustmentLayerToggle
            key={key}
            id={key}
            value={value as number}
            onChange={(value) => handleParameterChange(key, value as any)}
          />
        )

      case "solid":
        // For solid, the parameter can be a string (hex) or an object; show color only
        if (typeof value === "string") {
          inputValue = value
        } else if (value && typeof (value as any).color === "string") {
          inputValue = (value as any).color
        } else {
          inputValue = (TOOL_VALUES.solid as any).defaultValue.color
        }
        return (
          <AdjustmentLayerColor
            key={key}
            id={key}
            value={inputValue as string}
            onChange={(value) => handleParameterChange(key, value as any)}
          />
        )
      case "recolor":
        // Legacy recolor kept for compatibility (color + amount)
        if (typeof value === "number") {
          inputValue = {
            value,
            color: (TOOL_VALUES.recolor as any).defaultValue.color,
          }
        } else {
          inputValue = value ?? (TOOL_VALUES.recolor as any).defaultValue
        }
        return (
          <AdjustmentLayerColorAndSlider
            key={key}
            id={key}
            value={inputValue as ToolValueColorType["defaultValue"]}
            onChange={(value) => handleParameterChange(key, value as any)}
          />
        )
      case "recolorHue":
      case "recolorSaturation":
      case "recolorLightness":
      case "recolorAmount": {
        const def = (TOOL_VALUES as Record<string, any>)[key]?.defaultValue ?? 0
        const num = typeof value === "number" ? value : Number(value) || def
        return (
          <div className='grid grid-cols-[56px_1fr] items-center gap-2 px-2 h-10'>
            <span className='text-xs'>{key.replace("recolor", "")}</span>
            <AdjustmentLayerSlider
              key={key}
              id={key}
              value={num}
              onChange={(v) => handleParameterChange(key, v)}
            />
          </div>
        )
      }
      case "recolorPreserveLum":
        return (
          <div className='p-2'>
            <span className='text-xs'>Preserve Luminance</span>
            <AdjustmentLayerToggle
              key={key}
              id={key}
              value={(value ? 100 : 0) as number}
              onChange={(v) => handleParameterChange(key, v >= 50 ? 1 : 0)}
              className='rounded-sm'
            />
          </div>
        )
      default:
        if (typeof value === "number") {
          inputValue =
            value ??
            (TOOL_VALUES[key as keyof typeof TOOL_VALUES] as any).defaultValue
        } else {
          inputValue =
            (value as any)?.value ??
            (TOOL_VALUES[key as keyof typeof TOOL_VALUES] as any).defaultValue
        }
        return (
          <AdjustmentLayerSlider
            key={key}
            id={key}
            value={inputValue as number}
            onChange={(value) => handleParameterChange(key, value)}
            className='px-2'
          />
        )
    }
  }

  return (
    <div className='flex items-center mb-4 rounded-b-sm min-h-10 border'>
      <div className='flex flex-col  w-full'>
        {Object.entries(layer.parameters).map(([key, value]) =>
          renderParameterControl(key, value)
        )}
      </div>
    </div>
  )
}

export interface AdjustmentLayerColorProps {
  id: string
  value: string
  onChange: (value: string) => void
}

export function AdjustmentLayerColor({
  value,
  onChange,
}: AdjustmentLayerColorProps) {
  return (
    <div className='flex items-center gap-2 px-2'>
      <Color
        isPopover={false}
        color={value}
        colors={colorPalette}
        disabled={false}
        onSelect={onChange}
        onCustomColorChange={([id, value]) => onChange(value)}
      />
    </div>
  )
}

export interface AdjustmentLayerSliderProps
  extends React.ComponentProps<"div"> {
  id: string
  value: number
  onChange: (value: number) => void
}

export function AdjustmentLayerSlider({
  className,
  id,
  value,
  onChange,
}: AdjustmentLayerSliderProps) {
  return (
    <div className={cn("grid grid-cols-[1fr_32px] items-center", className)}>
      <input
        id={id}
        type='range'
        min={(TOOL_VALUES[id as keyof typeof TOOL_VALUES] as any).min}
        max={(TOOL_VALUES[id as keyof typeof TOOL_VALUES] as any).max}
        step={(TOOL_VALUES[id as keyof typeof TOOL_VALUES] as any).step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className='h-1 bg-accent rounded-full appearance-none cursor-pointer flex-1'
      />
      <span className='text-xs block text-right'>{value as number}</span>
    </div>
  )
}

export interface AdjustmentLayerColorAndSliderProps {
  id: string
  value: ToolValueColorType["defaultValue"]
  onChange: (value: ToolValueColorType["defaultValue"]) => void
}

export function AdjustmentLayerColorAndSlider({
  id,
  value: { value, color },
  onChange,
}: AdjustmentLayerColorAndSliderProps) {
  console.log(value, color)
  const handleOnChange =
    (key: "value" | "color") => (input: number | string) => {
      onChange({
        value,
        color,
        [key]: input,
      })
    }
  return (
    <div className='flex items-center gap-2 px-2'>
      <AdjustmentLayerSlider
        id={id}
        value={value}
        onChange={handleOnChange("value")}
      />
      <Color
        color={color}
        colors={colorPalette}
        disabled={false}
        onSelect={handleOnChange("color")}
        onCustomColorChange={([id, value]) =>
          handleOnChange(id as "value" | "color")(value)
        }
      />
    </div>
  )
}

export interface AdjustmentLayerToggleProps {
  className?: string
  id: string
  toggleClassName?: string
  value: number
  onChange: (value: number) => void
}

export function AdjustmentLayerToggle({
  className,
  id,
  toggleClassName,
  value,
  onChange,
}: AdjustmentLayerToggleProps) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <ToggleSwitch
        id={id}
        title='Toggle invert'
        checked={Boolean(value)}
        onCheckedChange={(checked: boolean) => onChange(checked ? 100 : 0)}
        className={cn("w-full h-10 p-0 rounded-t-none rounded-b-sm")}
      />
    </div>
  )
}
