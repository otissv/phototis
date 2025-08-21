"use client"

import Upscaler from "upscaler"

import type { ImageEditorToolsState } from "@/lib/state.image-editor"

const upscaler = new Upscaler()

export async function upscaleTool({
  imageUrl,
  upscale,
  patchSize = 64,
  padding = 2,
  awaitNextFrame = true,
  onProgress,
}: {
  imageUrl: string
  upscale: ImageEditorToolsState["upscale"]
  patchSize?: number
  padding?: number
  awaitNextFrame?: boolean
  onProgress?: (progress: number) => void
}): Promise<Base64URLString | undefined> {
  if (!imageUrl || !upscale) return

  if (upscale) {
    try {
      return await upscaler.upscale(imageUrl, {
        output: "base64",
        patchSize,
        padding,
        awaitNextFrame,
        progress: (progress) => {
          onProgress?.(progress)
        },
      })
    } catch (error) {
      console.error("Error during upscaling:", error)
    }
  }
}
