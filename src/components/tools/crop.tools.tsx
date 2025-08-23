"use client"

import * as React from "react"
import { CropIcon, ChevronDown } from "lucide-react"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import type { ImageEditorFooterProps } from "./utils.tools"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ToolValueCropType } from "@/lib/tools"

function CropButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("crop")}
      isActive={selectedTool === "crop"}
      disabled={progress}
      className='flex items-center gap-2'
    >
      <CropIcon className='w-4 h-4' />
      Crop
    </ImageEditorButton>
  )
}
CropButton.displayName = "CropButton"

function CropControls({
  value,
}: Omit<ImageEditorFooterProps, "onSelectedToolChange">) {
  const hostValue = value as ToolValueCropType["defaultValue"]

  const [width, setWidth] = React.useState(hostValue.width)
  const [height, setHeight] = React.useState(hostValue.height)
  const [overlay, setOverlay] = React.useState(hostValue.overlay)

  const handleOverlayChange = (value: string) => {
    setOverlay(value as "thirdGrid" | "phiGrid" | "goldenGrid" | "diagonals")
  }

  const handleWidthChange = (value: string) => {
    setWidth(Number.parseInt(value))
  }

  const handleHeightChange = (value: string) => {
    setHeight(Number.parseInt(value))
  }

  return (
    <div className='flex items-center justify-center gap-2 text-s my-4'>
      <div className='flex items-center gap-2'>
        <span>Crop: </span>
        <span>
          {width} x {height}
        </span>
        px
      </div>
      <Select defaultValue={overlay} onValueChange={handleOverlayChange}>
        <SelectTrigger className='h-8 w-28 rounded-sm'>
          <SelectValue placeholder='Third Grid' />
        </SelectTrigger>
        <SelectContent className='rounded-sm'>
          <SelectItem value='thirdGrid'>Third Grid</SelectItem>
          <SelectItem value='phiGrid'>Phi Grid</SelectItem>
          <SelectItem value='goldenGrid'>Golden Grid</SelectItem>
          <SelectItem value='diagonals'>Diagonals</SelectItem>
        </SelectContent>
      </Select>

      <Button size='icon' className='rounded-sm h-8 w-fit px-4'>
        Save
      </Button>
    </div>
  )
}
export { CropButton, CropControls }
