"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface HueButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function HueButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: HueButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("hue")}
      isActive={selectedTool === "hue"}
      disabled={progress}
    >
      Hue
    </ImageEditorButton>
  )
}
HueButton.displayName = "HueButton"

const HueControls = ImageEditorFooterSlider
export { HueButton, HueControls }
