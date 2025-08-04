"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface BrightnessButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function BrightnessButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: BrightnessButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("brightness")}
      isActive={selectedTool === "brightness"}
      disabled={progress}
    >
      Brightness
    </ImageEditorButton>
  )
}
BrightnessButton.displayName = "BrightnessButton"

const BrightnessControls = ImageEditorFooterSlider

export { BrightnessButton, BrightnessControls }
