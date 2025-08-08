"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface GrayscaleButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function GrayscaleButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: GrayscaleButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("grayscale")}
      isActive={selectedTool === "grayscale"}
      disabled={progress}
    >
      Grayscale
    </ImageEditorButton>
  )
}
GrayscaleButton.displayName = "GrayscaleButton"

const GrayscaleControls = ImageEditorFooterSlider
export { GrayscaleButton, GrayscaleControls }
