"use client"

import { Scaling } from "lucide-react"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

function ScaleButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("scale")}
      isActive={selectedTool === "scale"}
      disabled={progress}
      className='flex items-center gap-2'
    >
      <Scaling className='h-4 w-4' />
      Scale
    </ImageEditorButton>
  )
}
ScaleButton.displayName = "ScaleButton"

const ScaleControls = ImageEditorFooterSlider
export { ScaleButton, ScaleControls }
