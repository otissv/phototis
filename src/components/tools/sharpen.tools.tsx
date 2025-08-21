"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface SharpenButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function SharpenButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: SharpenButtonProps) {
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
