"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface SharpenButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function SharpenButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: SharpenButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("sharpen")}
      isActive={selectedTool === "sharpen"}
      disabled={progress}
    >
      Sharpen
    </ImageEditorButton>
  )
}
SharpenButton.displayName = "SharpenButton"

const SharpenControls = ImageEditorFooterSlider
export { SharpenButton, SharpenControls }
