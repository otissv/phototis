"use client"

import React from "react"
import { ImageUpscale } from "lucide-react"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import type { ImageLayer } from "@/lib/editor/state"
import { useEditorContext } from "@/lib/editor/context"
import { upscaleTool } from "@/components/tools/upscaler"
import { Progress } from "@/ui/progress"
import type { ImageEditorFooterProps } from "./utils.tools"
import { cn } from "@/lib/utils"

function UpscaleButton({
  progress,
  value,
  dispatch,
  selectedLayer,
  selectedTool,
  onProgress,
}: ImageEditorButtonProps) {
  const [upscale, setUpscale] = React.useState(value)
  const { addImageLayer } = useEditorContext()
  const [isRunning, setIsRunning] = React.useState(false)

  React.useEffect(() => {
    setUpscale(value)
  }, [value])

  const toFile = React.useCallback(
    (dataUrl: string, name: string): File | null => {
      try {
        const parts = dataUrl.split(",")
        const mimeMatch = parts[0].match(/data:(.*?);base64/)
        const mime = mimeMatch ? mimeMatch[1] : "image/png"
        const bstr = atob(parts[1] || "")
        const n = bstr.length
        const u8arr = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i)
        }
        return new File([u8arr], name, { type: mime })
      } catch (e) {
        console.error("Failed to convert base64 to File", e)
        return null
      }
    },
    []
  )

  const handleUpscale = React.useCallback(async () => {
    if (isRunning) return
    if (!selectedLayer || selectedLayer.type !== "image") return
    const imgLayer = selectedLayer as ImageLayer
    if (!imgLayer.image) return

    try {
      setIsRunning(true)
      onProgress?.(1)
      const objectUrl = URL.createObjectURL(imgLayer.image)
      const base64 = await upscaleTool({
        imageUrl: objectUrl,
        upscale: { upscale } as any,
        onProgress: (p) => {
          // upscale-js reports 0..1
          const pct = Math.max(0, Math.min(100, Math.round((p || 0) * 100)))
          onProgress?.(pct)
        },
      })
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {}

      if (!base64) {
        onProgress?.(0)
        setIsRunning(false)
        return
      }

      const fileName = (imgLayer.image as File).name || "upscaled.png"
      const file = toFile(base64 as unknown as string, fileName) || undefined
      if (file) {
        addImageLayer(file)
        // bump the counter/state for UX/history
        dispatch({ type: "upscale", payload: upscale + 1 } as any)
      }
    } catch (e) {
      console.error("Upscale failed", e)
    } finally {
      onProgress?.(0)
      setIsRunning(false)
    }
  }, [
    isRunning,
    selectedLayer,
    addImageLayer,
    dispatch,
    upscale,
    onProgress,
    toFile,
  ])

  return (
    <ImageEditorButton
      variant='ghost'
      // onClick={handleUpscale}
      isActive={selectedTool === "upscale"}
      disabled={Boolean(progress) || isRunning}
      className='flex items-center gap-2'
    >
      <ImageUpscale className='h-4 w-4' />
      Upscale
    </ImageEditorButton>
  )
}
UpscaleButton.displayName = "UpscaleButton"

function UpscaleControls({
  progress = 0,
}: Omit<ImageEditorFooterProps, "onSelectedToolChange">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-sm my-4",
        "w-sm md:w-md lg:w-lg xl:w-xl 2xl:w-2xl 3xl:w-3xl 4xl:w-4xl 5xl:w-5xl"
      )}
    >
      {progress > 0 && (
        <>
          <span>Upscaling {progress}%</span>
          <Progress value={progress} className='h-1 rounded-sm' />
        </>
      )}
    </div>
  )
}

export { UpscaleButton, UpscaleControls }
