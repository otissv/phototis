"use client"

import { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import SlidingTrack from "@/components/sliding-track"
import { cn, onToolControlValueChange } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"

export interface BrightnessButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function BrightnessButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: BrightnessButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("brightness")}
      isActive={selectedTool === "brightness"}
      disabled={progress}
    >
      Brightness
    </ImageEditorButton>
  )
}
BrightnessButton.displayName = "BrightnessButton"

function BrightnessControls({
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
BrightnessControls.displayName = "BrightnessControls"
export { BrightnessButton, BrightnessControls }
