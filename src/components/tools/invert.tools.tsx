"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface InvertButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function InvertButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: InvertButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("invert")}
      isActive={selectedTool === "invert"}
      disabled={progress}
    >
      Invert
    </ImageEditorButton>
  )
}
InvertButton.displayName = "InvertButton"

const InvertControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Invert Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { InvertButton, InvertControls }
