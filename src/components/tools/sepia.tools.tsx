"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface SepiaButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function SepiaButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: SepiaButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("sepia")}
      isActive={selectedTool === "sepia"}
      disabled={progress}
    >
      Sepia
    </ImageEditorButton>
  )
}
SepiaButton.displayName = "SepiaButton"

const SepiaControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Sepia Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { SepiaButton, SepiaControls }
