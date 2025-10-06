"use client"

import { Fragment } from "react"
import { Eclipse, Palette, Sun, Droplets, Sparkles } from "lucide-react"

import type { ToolValueColorType } from "@/lib/tools/tools"
import { ParamControls } from "@/components/timeline/ParamControls"
import { getAdjustmentPlugin } from "@/lib/adjustments/registry"
import { useEditorContext } from "@/lib/editor/context"
import { sampleToolsAtTime } from "@/lib/tools/tools-state"
import { Color } from "@/components/ui/color"
import { colorPalette } from "@/components/ui/color-palette"
import type { AdjustmentLayer } from "@/lib/editor/state"
import { ToggleSwitch } from "../ui/toggle-switch"
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
    case "tint":
    case "colorize":
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
    parameters: Record<
      string,
      number | { value: number; color: string } | string
    >
  ) => void
}

export function AdjustmentLayerEditor({
  layer,
  onUpdate,
}: AdjustmentLayerEditorProps) {
  const { toolValues, getPlayheadTime } = useEditorContext()
  const playheadTime = getPlayheadTime()

  const sampledParams = sampleToolsAtTime(
    (layer.parameters || {}) as any,
    playheadTime
  )
  const handleParameterChange = (
    key: string,
    value: number | { value: number; color: string } | string
  ) => {
    // value is hex and we need to be converted to rgb
    onUpdate({ [key]: value })
  }

  const params = sampledParams
  const plugin = getAdjustmentPlugin(layer.adjustmentType as any)

  return (
    <div className='flex items-center rounded-b-sm min-h-10 border'>
      <div className='flex flex-col  w-full'>
        {plugin?.uiSchema?.length
          ? plugin.uiSchema.map((control) => {
              const key = control.key
              const val = (params as any)[key]
              if (control.type === "slider") {
                return (
                  <div key={key} className='px-2 py-1'>
                    <ParamControls
                      paramId={key}
                      value={val as any}
                      onChange={(v) => handleParameterChange(key, v as any)}
                      uiOverride={control}
                    />
                  </div>
                )
              }
              if (control.type === "toggle") {
                const ui = {
                  type: "toggle" as const,
                  label: control.label,
                }
                return (
                  <div key={key} className='px-2 py-1'>
                    <ParamControls
                      paramId={key}
                      value={val as any}
                      onChange={(v) => handleParameterChange(key, v as any)}
                      uiOverride={ui}
                    />
                  </div>
                )
              }
              if (control.type === "color") {
                const ui = {
                  type: "color" as const,
                  label: control.label,
                }
                return (
                  <div key={key} className='px-2 py-1'>
                    <ParamControls
                      paramId={key}
                      value={val as any}
                      onChange={(v) => handleParameterChange(key, v as any)}
                      uiOverride={ui}
                    />
                  </div>
                )
              }
              if (control.type === "color+slider") {
                const uiSlider = {
                  type: "slider" as const,
                  label: control.label ?? `${key} Amount`,
                  min: (toolValues as any)[key]?.min,
                  max: (toolValues as any)[key]?.max,
                  step: (toolValues as any)[key]?.step ?? 1,
                }
                const colorVal = (val as any)?.color ?? "#000000"
                const amountVal = Number((val as any)?.value ?? 0)
                return (
                  <div key={key} className='px-2 py-1'>
                    <div className='flex items-center gap-2'>
                      <ParamControls
                        paramId={key}
                        value={amountVal}
                        onChange={(v) =>
                          handleParameterChange(key, {
                            ...(val as any),
                            value: Number(v) || 0,
                          })
                        }
                        uiOverride={uiSlider}
                      />
                      <ParamControls
                        paramId={`${key}.color`}
                        value={colorVal}
                        onChange={(v) =>
                          handleParameterChange(key, {
                            ...(val as any),
                            color: String(v),
                          })
                        }
                        uiOverride={{
                          type: "color",
                          label: control.label ?? `${key} Color`,
                        }}
                      />
                    </div>
                  </div>
                )
              }
              return null
            })
          : Object.entries(params).map(([key, val]) => (
              <Fragment key={key}>
                <div className='px-2 py-1'>
                  <ParamControls
                    paramId={key}
                    value={val as any}
                    onChange={(val) => handleParameterChange(key, val as any)}
                  />
                </div>
              </Fragment>
            ))}
      </div>
    </div>
  )
}

export interface AdjustmentLayerColorProps {
  id: string
  parameters?: AdjustmentLayer["parameters"]
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
        onCustomColorChange={([_id, v]) => onChange(v)}
      />
    </div>
  )
}

export interface AdjustmentLayerSliderProps {
  className?: string
  grayScale?: boolean
  id: string
  parameters?: AdjustmentLayer["parameters"]
  style?: React.CSSProperties
  value: number
  onChange: (value: number) => void
  thumbColor?: string
  type?: "hue" | "grayscale" | "default"
}

export function AdjustmentLayerSlider({
  className,
  id,
  value,
  style,
  thumbColor = "#000000",
  type = "default",
  onChange,
}: AdjustmentLayerSliderProps) {
  const { toolValues } = useEditorContext()
  return (
    <div
      className={cn("grid grid-cols-[1fr_32px] items-center h-9", className)}
    >
      <input
        id={id}
        type='range'
        min={(toolValues as any)[id]?.min}
        max={(toolValues as any)[id]?.max}
        step={(toolValues as any)[id]?.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className='h-2 bg-accent rounded-full appearance-none cursor-pointer flex-1 range-thumb'
        style={{
          ["--thumb-color" as any]: thumbColor,
          ...(type === "grayscale"
            ? {
                background: "linear-gradient(to right, #000000, #ffffff)",
              }
            : undefined),
          ...(type === "hue"
            ? {
                background:
                  "linear-gradient(to right, #ff0000 0%, #ffff00 16.66%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.66%, #ff00ff 83.33%, #ff0000 100%)",
              }
            : undefined),
          ...style,
        }}
      />
      <span className='text-xs block text-right'>{value as number}</span>
    </div>
  )
}

export interface AdjustmentLayerColorAndSliderProps {
  id: string
  parameters?: AdjustmentLayer["parameters"]
  value: ToolValueColorType["defaultValue"]
  onChange: (value: ToolValueColorType["defaultValue"]) => void
}

export function AdjustmentLayerColorAndSlider({
  id,
  value: { value, color },
  onChange,
}: AdjustmentLayerColorAndSliderProps) {
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
  parameters?: AdjustmentLayer["parameters"]
  value: number
  onChange: (value: number) => void
}

export function AdjustmentLayerToggle({
  className,
  id,
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
        className={cn(
          "w-full h-9 p-0 rounded-t-none rounded-b-sm text-xs data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
        )}
        classNameThumb='h-8'
      />
    </div>
  )
}
