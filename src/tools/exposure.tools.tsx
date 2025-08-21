"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

export interface ExposureButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ExposureButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ExposureButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("exposure")}
      isActive={selectedTool === "exposure"}
      disabled={progress}
    >
      Exposure
    </ImageEditorButton>
  )
}
ExposureButton.displayName = "ExposureButton"

const ExposureControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Exposure Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { ExposureButton, ExposureControls }
