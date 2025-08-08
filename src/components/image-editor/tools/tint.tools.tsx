"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface TintButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function TintButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: TintButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("tint")}
      isActive={selectedTool === "tint"}
      disabled={progress}
    >
      Tint
    </ImageEditorButton>
  )
}
TintButton.displayName = "TintButton"

const TintControls = ImageEditorFooterSlider
export { TintButton, TintControls }
