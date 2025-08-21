"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

export interface RotationButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
}

function RotationButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: RotationButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("rotate")}
      isActive={selectedTool === "rotate"}
      disabled={progress}
    >
      Rotation
    </ImageEditorButton>
  )
}
RotationButton.displayName = "RotationButton"

const RotationControls = ImageEditorFooterSlider

export { RotationButton, RotationControls }
