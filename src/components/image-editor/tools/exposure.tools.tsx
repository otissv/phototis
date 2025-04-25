"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface ExposureButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ExposureButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ExposureButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("exposure")}
      isActive={selectedTool === "exposure"}
      disabled={progress}
    >
      Exposure
    </ImageEditorButton>
  )
}
ExposureButton.displayName = "ExposureButton"

const ExposureControls = ImageEditorFooterSlider
export { ExposureButton, ExposureControls }
