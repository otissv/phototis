"use client"

import type { TOOL_VALUES } from "@/lib/state.image-editor"
import { ImageEditorButton } from "@/image-editor/button.image-editor"
import { ImageEditorFooterSlider } from "@/image-editor/footer-slider.image-editor"

export interface HueButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function HueButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: HueButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("hue")}
      isActive={selectedTool === "hue"}
      disabled={progress}
    >
      Hue
    </ImageEditorButton>
  )
}
HueButton.displayName = "HueButton"

const HueControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Hue Drag")}
      onChange={(v: number) => props.onChange?.(v)}
      onDragEnd={() => history.end(true)}
    />
  )
}
export { HueButton, HueControls }
