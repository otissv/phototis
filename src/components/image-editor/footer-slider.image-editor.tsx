"use client"

import { TOOL_VALUES } from "@/constants"
import { onToolControlValueChange } from "@/lib/utils"
import SlidingTrack from "../sliding-track"

export interface ImageEditorFooterSliderProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "value"> {
  operator?: string
  selectedTool: keyof typeof TOOL_VALUES
  value: number
  label?: (value: number, operator: string) => React.ReactNode
  onChange?: (value: number) => void
  progress?: number
  setIsUpdating: (isUpdating: boolean) => void
}

export function ImageEditorFooterSlider({
  className,
  operator,
  selectedTool,
  value,
  label,
  onChange,
  progress,
  setIsUpdating,
}: ImageEditorFooterSliderProps) {
  const disabled = Boolean(progress)

  return (
    <SlidingTrack
      title={selectedTool}
      className={className}
      min={
        "min" in TOOL_VALUES[selectedTool] ? TOOL_VALUES[selectedTool].min : 0
      }
      max={
        "max" in TOOL_VALUES[selectedTool] ? TOOL_VALUES[selectedTool].max : 0
      }
      step={
        "step" in TOOL_VALUES[selectedTool] ? TOOL_VALUES[selectedTool].step : 0
      }
      defaultValue={value}
      operator={operator}
      onValueChange={onToolControlValueChange({
        selectedTool,
        onChange: onChange || (() => {}),
      })}
      label={label}
      disabled={disabled}
      setIsUpdating={setIsUpdating}
    />
  )
}
ImageEditorFooterSlider.displayName = "ImageEditorFooterSlider"
