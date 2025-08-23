"use client"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

function SharpenButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("sharpen")}
      isActive={selectedTool === "sharpen"}
      disabled={progress}
    >
      Sharpen
    </ImageEditorButton>
  )
}
SharpenButton.displayName = "SharpenButton"

const SharpenControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Sharpen Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { SharpenButton, SharpenControls }
