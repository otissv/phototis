"use client"

import React from "react"

import { ImageEditorButton } from "@/image-editor/button.image-editor"
import type { ImageEditorToolsActions } from "@/lib/state.image-editor"

export interface UpscaleButtonProps {
  progress?: number
  value: number
  dispatch: React.Dispatch<ImageEditorToolsActions>
}

function UpscaleButton({ progress, value, dispatch }: UpscaleButtonProps) {
  const [upscale, setUpscale] = React.useState(value)

  React.useEffect(() => {
    setUpscale(value)
  }, [value])

  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => dispatch({ type: "upscale", payload: upscale + 1 })}
      disabled={progress}
    >
      Upscale
    </ImageEditorButton>
  )
}
UpscaleButton.displayName = "UpscaleButton"

export { UpscaleButton }
