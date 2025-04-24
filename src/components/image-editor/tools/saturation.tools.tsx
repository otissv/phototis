"use client"

import { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import SlidingTrack from "@/components/sliding-track"
import { cn, onToolControlValueChange } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"

export interface SaturationButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function SaturationButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: SaturationButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("saturation")}
      isActive={selectedTool === "saturation"}
      disabled={progress}
    >
      Saturation
    </ImageEditorButton>
  )
}
SaturationButton.displayName = "SaturationButton"

function SaturationControls({
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
SaturationControls.displayName = "SaturationControls"
export { SaturationButton, SaturationControls }
