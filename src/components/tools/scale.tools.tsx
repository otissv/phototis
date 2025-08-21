"use client"

import type { TOOL_VALUES } from "@/lib/tools"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface ScaleButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
}

function ScaleButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ScaleButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("scale")}
      isActive={selectedTool === "scale"}
      disabled={progress}
    >
      Zoom
    </ImageEditorButton>
  )
}
ScaleButton.displayName = "ScaleButton"

const ScaleControls = ImageEditorFooterSlider
export { ScaleButton, ScaleControls }
