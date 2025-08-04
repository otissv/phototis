"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface ContrastButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ContrastButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ContrastButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("contrast")}
      isActive={selectedTool === "contrast"}
      disabled={progress}
    >
      Contrast
    </ImageEditorButton>
  )
}
ContrastButton.displayName = "ContrastButton"

const ContrastControls = ImageEditorFooterSlider
export { ContrastButton, ContrastControls }
