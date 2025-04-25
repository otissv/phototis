"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface SaturationButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function SaturationButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: SaturationButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("saturation")}
      isActive={selectedTool === "saturation"}
      disabled={progress}
    >
      Saturation
    </ImageEditorButton>
  )
}
SaturationButton.displayName = "SaturationButton"

const SaturationControls = ImageEditorFooterSlider
export { SaturationButton, SaturationControls }
