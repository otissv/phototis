"use client"

import type { TOOL_VALUES } from "@/lib/tools"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface NoiseButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function NoiseButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: NoiseButtonProps) {
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
