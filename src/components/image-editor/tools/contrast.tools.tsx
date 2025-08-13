"use client"

import type { TOOL_VALUES } from "@/constants"
import { ImageEditorButton } from "../button.image-editor"
import { ImageEditorFooterSlider } from "../footer-slider.image-editor"

export interface ContrastButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ContrastButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ContrastButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("contrast")}
      isActive={selectedTool === "contrast"}
      disabled={progress}
    >
      Contrast
    </ImageEditorButton>
  )
}
ContrastButton.displayName = "ContrastButton"

const ContrastControls = (props: any) => {
  const { history } = require("@/lib/editor/context").useEditorContext()
  const overlay = () =>
    document.getElementById("image-editor-overlay") as HTMLCanvasElement | null
  const clear = () => {
    const c = overlay()
    const ctx = c?.getContext("2d")
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
  }
  return (
    <ImageEditorFooterSlider
      {...props}
      onDragStart={() => history.begin("Contrast Drag")}
      onChange={(v: number) => props.onChange?.(v)}
      onDragEnd={() => {
        history.end(true)
        clear()
      }}
    />
  )
}
export { ContrastButton, ContrastControls }
