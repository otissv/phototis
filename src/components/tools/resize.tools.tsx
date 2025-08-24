"use client"

import React from "react"
import { Expand, Link2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ImageEditorFooterProps } from "@/components/tools/utils.tools"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import type { ImageLayer } from "@/lib/editor/state"

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ResizeButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("resize")}
      isActive={selectedTool === "resize"}
      disabled={progress}
      className='flex items-center gap-2'
    >
      <Expand className='h-4 w-4' />
      Resize
    </ImageEditorButton>
  )
}
ResizeButton.displayName = "ResizeButton"

function ResizeControls({
  onChange,
  selectedLayer,
  dispatch,
  toolsValues,
}: Omit<ImageEditorFooterProps, "onSelectedToolChange">) {
  const [width, setWidth] = React.useState<number>(0)
  const [height, setHeight] = React.useState<number>(0)
  const [originalAspectRatio, setOriginalAspectRatio] =
    React.useState<number>(1)
  const [preserveAspectRatio, setPreserveAspectRatio] =
    React.useState<boolean>(true)

  const image = (selectedLayer as ImageLayer).image

  // Initialize from selected layer current resize or image file dimensions
  React.useEffect(() => {
    const init = async () => {
      let w = 0
      let h = 0
      const tv: any = toolsValues || {}
      if (
        tv.resize &&
        typeof tv.resize.width === "number" &&
        typeof tv.resize.height === "number" &&
        tv.resize.width > 0 &&
        tv.resize.height > 0
      ) {
        w = tv.resize.width
        h = tv.resize.height
      } else if (image) {
        try {
          const dim = await getImageDimensions(image)
          w = dim.width
          h = dim.height
        } catch (err) {
          console.error("Failed to get image size", err)
        }
      }
      if (w > 0 && h > 0) {
        setWidth(w)
        setHeight(h)
        setOriginalAspectRatio(w / h)
      }
    }
    void init()
  }, [])

  const handleOnChange =
    (type: "width" | "height") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number.parseInt(e.target.value)
      if (Number.isNaN(newValue)) return

      let newWidth = width
      let newHeight = height

      if (type === "width") {
        newWidth = newValue
        if (preserveAspectRatio) {
          newHeight = Math.round(newWidth / originalAspectRatio)
        }
      } else {
        newHeight = newValue
        if (preserveAspectRatio) {
          newWidth = Math.round(newHeight * originalAspectRatio)
        }
      }

      setWidth(newWidth)
      setHeight(newHeight)

      // Fire local onChange label handler if provided
      onChange?.(0 as any)
      // Persist to selected layer filters via reducer
      dispatch?.({
        type: "resize",
        payload: { width: newWidth, height: newHeight },
      } as any)
    }

  return (
    <div className='grid grid-cols-[1fr_auto_1fr] justify-center items-center gap-2'>
      <label
        htmlFor='width'
        className='flex justify-center text-sm col-start-1 row-start-1'
      >
        Width px
      </label>
      <Input
        id='width'
        type='number'
        className='col-start-1 row-start-2 w-20 rounded-full'
        value={width}
        onChange={handleOnChange("width")}
      />

      <Button
        variant='ghost'
        className={cn("col-start-2 row-start-2 rounded-full", {
          "bg-accent text-accent-foreground": preserveAspectRatio,
        })}
        size='icon'
        onClick={() => setPreserveAspectRatio(!preserveAspectRatio)}
      >
        <Link2
          className={cn("h-4 w-4", {
            "text-muted-foreground": !preserveAspectRatio,
          })}
        />
      </Button>
      <label
        htmlFor='height'
        className='flex justify-center text-sm col-start-3 row-start-1'
      >
        Height px
      </label>
      <Input
        id='height'
        type='number'
        className='col-start-3 row-start-2 w-20 rounded-full'
        value={height}
        onChange={handleOnChange("height")}
      />
    </div>
  )
}
ResizeControls.displayName = "ResizeControls"
export { ResizeButton, ResizeControls }
