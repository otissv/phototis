"use client"

import { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button-image-editor"
import SlidingTrack from "@/components/sliding-track"
import { cn, onToolControlValueChange } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"

export interface ScaleButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ScaleButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ScaleButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("scale")}
      isActive={selectedTool === "scale"}
      disabled={progress}
    >
      Scale
    </ImageEditorButton>
  )
}
ScaleButton.displayName = "ScaleButton"

function ScaleControls({
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
      value={value}
      defaultValue={TOOL_VALUES[selectedTool].defaultValue as number}
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
ScaleControls.displayName = "ScaleControls"
export { ScaleButton, ScaleControls }
