"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

export interface TemperatureButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function TemperatureButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: TemperatureButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("temperature")}
      isActive={selectedTool === "temperature"}
      disabled={progress}
    >
      Temperature
    </ImageEditorButton>
  )
}
TemperatureButton.displayName = "TemperatureButton"

const TemperatureControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Temperature Drag")}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { TemperatureButton, TemperatureControls }
