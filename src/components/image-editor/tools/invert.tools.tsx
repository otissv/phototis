"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface InvertButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function InvertButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: InvertButtonProps) {
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
InvertButton.displayName = "InvertButton"

const InvertControls = ImageEditorFooterSlider
export { InvertButton, InvertControls }
