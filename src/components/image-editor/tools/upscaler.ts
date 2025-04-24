"use client"

import Upscaler from "upscaler"

import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"

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

      // if (upscaledImage) {
      //   width = upscaledImage.width
      //   height = upscaledImage.height

      //   // Update canvas dimensions
      //   canvas.width = width
      //   canvas.height = height
      //   gl.viewport(0, 0, width, height)

      //   // Upload upscaled image to GPU
      //   gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
      //   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upscaledImage)

      //   // Trigger redraw
      //   draw()
      //   return
      // }
    } catch (error) {
      console.error("Error during upscaling:", error)
    }
  }
}
