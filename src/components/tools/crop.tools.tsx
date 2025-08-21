"use client"

import type { TOOL_VALUES } from "@/lib/tools"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface CropButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
}

function CropButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: CropButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("crop")}
      isActive={selectedTool === "crop"}
      disabled={progress}
    >
      Crop
    </ImageEditorButton>
  )
}
CropButton.displayName = "CropButton"

const CropControls = ImageEditorFooterSlider
export { CropButton, CropControls }
