"use client"

import { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button-image-editor"
import SlidingTrack from "@/components/sliding-track"
import { cn, onToolControlValueChange } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"

export interface TemperatureButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function TemperatureButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: TemperatureButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("temperature")}
      isActive={selectedTool === "temperature"}
      disabled={progress}
    >
      Temperature
    </ImageEditorButton>
  )
}
TemperatureButton.displayName = "TemperatureButton"

function TemperatureControls({
  className,
  operator,
  selectedTool,
  value,
  label,
  onChange,
  progress,
}: Omit<ImageEditorFooterProps, "dispatch" | "onSelectedToolChange">) {
  return (
    <SlidingTrack
      title={selectedTool}
      className={className}
      min={TOOL_VALUES[selectedTool].min}
      max={TOOL_VALUES[selectedTool].max}
      step={TOOL_VALUES[selectedTool].step}
      defaultValue={value}
      operator={operator}
      onValueChange={onToolControlValueChange({
        selectedTool,
        onChange: onChange || (() => {}),
      })}
      label={label}
      disabled={progress}
    />
  )
}
TemperatureControls.displayName = "TemperatureControls"
export { TemperatureButton, TemperatureControls }
