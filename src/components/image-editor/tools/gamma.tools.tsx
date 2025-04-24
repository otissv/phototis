"use client"

import { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import SlidingTrack from "@/components/sliding-track"
import { cn, onToolControlValueChange } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"

export interface GammaButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function GammaButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: GammaButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("gamma")}
      isActive={selectedTool === "gamma"}
      disabled={progress}
    >
      Gamma
    </ImageEditorButton>
  )
}
GammaButton.displayName = "GammaButton"

function GammaControls({
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
GammaControls.displayName = "GammaControls"
export { GammaButton, GammaControls }
