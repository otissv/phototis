"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface GammaButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function GammaButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: GammaButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("gamma")}
      isActive={selectedTool === "gamma"}
      disabled={progress}
    >
      Gamma
    </ImageEditorButton>
  )
}
GammaButton.displayName = "GammaButton"

const GammaControls = ImageEditorFooterSlider
export { GammaButton, GammaControls }
