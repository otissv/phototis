"use client"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/ui/footer-slider.image-editor"

function NoiseButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("noise")}
      isActive={selectedTool === "noise"}
      disabled={progress}
    >
      Noise
    </ImageEditorButton>
  )
}
NoiseButton.displayName = "NoiseButton"

const NoiseControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Noise Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { NoiseButton, NoiseControls }
