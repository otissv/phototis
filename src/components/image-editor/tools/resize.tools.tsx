"use client"

import type { TOOL_VALUES } from "@/constants"
import { cn } from "@/lib/utils"
import type { ImageEditorFooterProps } from "./utils.tools"
import { Input } from "@/components/ui/input"

import React from "react"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageEditorButton } from "../button.image-editor"

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

export interface ResizeButtonProps {
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  selectedTool: keyof typeof TOOL_VALUES
  progress?: number
}

function ResizeButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ResizeButtonProps) {
  return (
    <ImageEditorButton
      variant='outline'
      onClick={() => onSelectedToolChange("resize")}
      isActive={selectedTool === "resize"}
      disabled={progress}
    >
      Resize
    </ImageEditorButton>
  )
}
ResizeButton.displayName = "ResizeButton"

function ResizeControls({
  onChange,
  image,
}: Omit<ImageEditorFooterProps, "dispatch" | "onSelectedToolChange">) {
  const [width, setWidth] = React.useState<number>(0)
  const [height, setHeight] = React.useState<number>(0)
  const [originalAspectRatio, setOriginalAspectRatio] =
    React.useState<number>(1)
  const [preserveAspectRatio, setPreserveAspectRatio] =
    React.useState<boolean>(true)

  React.useEffect(() => {
    const dimensions = async () => {
      if (!image) return null
      try {
        const { width, height } = await getImageDimensions(image)
        setWidth(width)
        setHeight(height)
        setOriginalAspectRatio(width / height)
      } catch (err) {
        console.error("Failed to get image size", err)
      }
    }
    dimensions()
  }, [image])

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

      onChange?.({ width: newWidth, height: newHeight } as any)
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
