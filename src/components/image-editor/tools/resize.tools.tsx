"use client"

import { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button-image-editor"
import SlidingTrack from "@/components/sliding-track"
import { cn, onToolControlValueChange } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"

export interface ResizeButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ResizeButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ResizeButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("resize")}
      isActive={selectedTool === "resize"}
      disabled={progress}
    >
      Resize
    </ImageEditorButton>
  )
}
ResizeButton.displayName = "ResizeButton"

function ResizeControls({
  className,
  operator,
  selectedTool,
  value,
  label,
  onChange,
  progress,
}: Omit<ImageEditorFooterProps, "dispatch" | "onSelectedToolChange">) {
  return <div>Resizetool</div>
}
ResizeControls.displayName = "ResizeControls"
export { ResizeButton, ResizeControls }
