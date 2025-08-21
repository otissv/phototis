"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

export interface GammaButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function GammaButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: GammaButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("gamma")}
      isActive={selectedTool === "gamma"}
      disabled={progress}
    >
      Gamma
    </ImageEditorButton>
  )
}
GammaButton.displayName = "GammaButton"

const GammaControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Gamma Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { GammaButton, GammaControls }
