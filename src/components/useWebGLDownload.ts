"use client"

import React from "react"

export function useWebGLDownload(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  drawFnRef: React.RefObject<() => void>
) {
  return React.useCallback(
    (mimeType: string, quality = 1.0) => {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl2")
        if (!gl) return

        gl.finish()
        drawFnRef.current() // ensures the latest frame is rendered

        const width = gl.drawingBufferWidth
        const height = gl.drawingBufferHeight

        // Ensure we're reading from the main canvas (default framebuffer)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        const pixels = new Uint8Array(width * height * 4)
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

        const tempCanvas = document.createElement("canvas")
        tempCanvas.width = width
        tempCanvas.height = height
        const tempCtx = tempCanvas.getContext("2d")
        if (!tempCtx) return

        const imageData = tempCtx.createImageData(width, height)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIndex = ((height - y - 1) * width + x) * 4
            const destIndex = (y * width + x) * 4
            imageData.data.set(pixels.slice(srcIndex, srcIndex + 4), destIndex)
          }
        }
        tempCtx.putImageData(imageData, 0, 0)

        tempCanvas.toBlob(
          (blob) => {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `image-editor.${mimeType.split("/")[1]}`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          },
          mimeType,
          quality
        )
      })
    },
    [canvasRef, drawFnRef.current]
  )
}
