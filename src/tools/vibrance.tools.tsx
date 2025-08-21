"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

export interface VibranceButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function VibranceButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: VibranceButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("vibrance")}
      isActive={selectedTool === "vibrance"}
      disabled={progress}
    >
      Vibrance
    </ImageEditorButton>
  )
}
VibranceButton.displayName = "VibranceButton"

const VibranceControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Vibrance Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { VibranceButton, VibranceControls }
