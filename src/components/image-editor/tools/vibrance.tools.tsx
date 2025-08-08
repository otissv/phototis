"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface VibranceButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function VibranceButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: VibranceButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("vibrance")}
      isActive={selectedTool === "vibrance"}
      disabled={progress}
    >
      Vibrance
    </ImageEditorButton>
  )
}
VibranceButton.displayName = "VibranceButton"

const VibranceControls = ImageEditorFooterSlider
export { VibranceButton, VibranceControls }
