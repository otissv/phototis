"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

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
