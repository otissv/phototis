"use client"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/ui/footer-slider.image-editor"

function GrainButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("grain")}
      isActive={selectedTool === "grain"}
      disabled={progress}
    >
      Grain
    </ImageEditorButton>
  )
}
GrainButton.displayName = "GrainButton"

const GrainControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Grain Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { GrainButton, GrainControls }
