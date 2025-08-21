"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/components/button.image-editor"
import { ImageEditorFooterSlider } from "@/components/footer-slider.image-editor"

export interface GrainButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function GrainButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: GrainButtonProps) {
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
