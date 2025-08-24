"use client"

import * as React from "react"
import { CropIcon, ChevronDown } from "lucide-react"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import type { ImageEditorFooterProps } from "./utils.tools"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { ToolValueCropType } from "@/lib/tools"
import { Input } from "@/ui/input"

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
  selectedLayer,
  value,
  dispatch,
}: Omit<ImageEditorFooterProps, "onSelectedToolChange">) {
  const hostValue = value as ToolValueCropType["defaultValue"]

  const [overlay, setOverlay] = React.useState(hostValue.overlay)
  const [width, setWidth] = React.useState(hostValue.width)
  const [height, setHeight] = React.useState(hostValue.height)

  React.useEffect(() => {
    setOverlay(hostValue.overlay)
    setWidth(hostValue.width)
    setHeight(hostValue.height)
  }, [hostValue.overlay, hostValue.width, hostValue.height])

  const handleOverlayGridChange = (next: string) => {
    const overlay = next as "thirdGrid" | "phiGrid" | "goldenGrid" | "diagonals"
    setOverlay(overlay)
    dispatch?.({ type: "crop", payload: { overlay } as any })
    try {
      window.dispatchEvent(
        new CustomEvent("phototis:crop-overlay-changed", {
          detail: { overlay },
        })
      )
    } catch {}
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = Number(e.target.value) || 0
    setWidth(w)
    dispatch?.({ type: "crop", payload: { width: w, overlay } as any })
    try {
      window.dispatchEvent(
        new CustomEvent("phototis:crop-values-changed", {
          detail: { width: w, height },
        })
      )
    } catch {}
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value) || 0
    setHeight(h)
    dispatch?.({ type: "crop", payload: { height: h, overlay } as any })
    try {
      window.dispatchEvent(
        new CustomEvent("phototis:crop-values-changed", {
          detail: { width, height: h },
        })
      )
    } catch {}
  }

  const handleSave = React.useCallback(() => {
    // Notify canvas to commit crop on the selected layer
    const ev = new CustomEvent("phototis:commit-crop")
    window.dispatchEvent(ev)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: dispatch causes infinite loop
  React.useEffect(() => {
    // Sync width/height when overlay rectangle changes on canvas
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as {
          width?: number
          height?: number
        }
        if (!detail) return
        const w = Number(detail.width ?? width)
        const h = Number(detail.height ?? height)
        if (!Number.isNaN(w)) setWidth(w)
        if (!Number.isNaN(h)) setHeight(h)
        dispatch?.({
          type: "crop",
          payload: { width: w, height: h, overlay } as any,
        })
      } catch {}
    }
    window.addEventListener("phototis:crop-rect-changed", handler)
    // Request initial values when controls mount (or tool shown)
    try {
      window.dispatchEvent(new CustomEvent("phototis:request-crop-rect"))
    } catch {}
    return () =>
      window.removeEventListener("phototis:crop-rect-changed", handler)
  }, [width, height])

  return (
    <div className='flex items-center justify-center gap-6 text-s my-4'>
      <div className='flex items-center gap-2'>
        <span>Crop: </span>
        <span>
          <Input type='number' value={width} onChange={handleWidthChange} />
          x
          <Input type='number' value={height} onChange={handleHeightChange} />
          px
        </span>
      </div>
      <Select defaultValue={overlay} onValueChange={handleOverlayGridChange}>
        <SelectTrigger className='h-8 w-28 rounded-sm flex items-center gap-2'>
          <SelectValue placeholder='Third Grid' />
          <ChevronDown className='h-4 w-4' />
        </SelectTrigger>
        <SelectContent className='rounded-sm'>
          <SelectItem value='thirdGrid'>Third Grid</SelectItem>
          <SelectItem value='phiGrid'>Phi Grid</SelectItem>
          {/* <SelectItem value='goldenGrid'>Golden Grid</SelectItem> */}
          {/* <SelectItem value='diagonals'>Diagonals</SelectItem> */}
        </SelectContent>
      </Select>

      <Button
        size='icon'
        className='rounded-sm h-8 w-fit px-4'
        onClick={handleSave}
      >
        Save
      </Button>
    </div>
  )
}
export { CropButton, CropControls }
