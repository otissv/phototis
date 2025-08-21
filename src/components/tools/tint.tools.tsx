"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface TintButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function TintButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: TintButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("tint")}
      isActive={selectedTool === "tint"}
      disabled={progress}
    >
      Tint
    </ImageEditorButton>
  )
}
TintButton.displayName = "TintButton"

const TintControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Tint Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { TintButton, TintControls }
