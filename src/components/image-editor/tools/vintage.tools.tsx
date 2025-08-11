"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface VintageButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function VintageButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: VintageButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("vintage")}
      isActive={selectedTool === "vintage"}
      disabled={progress}
    >
      Vintage
    </ImageEditorButton>
  )
}
VintageButton.displayName = "VintageButton"

const VintageControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Vintage Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { VintageButton, VintageControls }
