"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface SepiaButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function SepiaButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: SepiaButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("sepia")}
      isActive={selectedTool === "sepia"}
      disabled={progress}
    >
      Sepia
    </ImageEditorButton>
  )
}
SepiaButton.displayName = "SepiaButton"

const SepiaControls = ImageEditorFooterSlider
export { SepiaButton, SepiaControls }
