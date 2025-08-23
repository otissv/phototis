"use client"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

function RotationButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
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
