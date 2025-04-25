"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface RotationButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function RotationButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: RotationButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("rotate")}
      isActive={selectedTool === "rotate"}
      disabled={progress}
    >
      Rotation
    </ImageEditorButton>
  )
}
RotationButton.displayName = "RotationButton"

const RotationControls = ImageEditorFooterSlider

export { RotationButton, RotationControls }
