"use client"

import React from "react"
import type { ImageEditorToolsState } from "./image-editor.state"

export interface ImageEditorCanvasProps extends React.ComponentProps<"canvas"> {
  image: File
  toolsValues: ImageEditorToolsState
}

export function ImageEditorCanvas({
  image,
  toolsValues,
  ...props
}: ImageEditorCanvasProps) {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const [imageUrl, setImageUrl] = React.useState<string>("")

  // Handle image URL creation and cleanup
  React.useEffect(() => {
    const url = URL.createObjectURL(image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  React.useEffect(() => {
    if (!imageUrl) return

    const ctx = canvas.current?.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      // Calculate aspect ratio
      const aspectRatio = img.width / img.height

      // Set canvas dimensions while maintaining aspect ratio
      const maxWidth = 800 // Maximum width
      const maxHeight = 600 // Maximum height

      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }

      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      // Set canvas dimensions to original size
      ctx.canvas.width = width
      ctx.canvas.height = height

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Save context state
      ctx.save()

      // Translate to center of canvas
      ctx.translate(width / 2, height / 2)

      // Apply flips
      if (toolsValues.flipHorizontal) {
        ctx.scale(-1, 1)
      }
      if (toolsValues.flipVertical) {
        ctx.scale(1, -1)
      }

      // Rotate
      const { rotate } = toolsValues
      const angle = (rotate * Math.PI) / 180 // Convert degrees to radians
      ctx.rotate(angle)

      // Draw image centered
      ctx.drawImage(img, -width / 2, -height / 2, width, height)

      // Restore context state
      ctx.restore()

      const { gamma, temperature, vintage, exposure } = toolsValues

      // Apply CSS filters first
      ctx.filter = applyFilters(toolsValues)

      // Draw image with CSS filters
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(width / 2, height / 2)

      // Apply flips again for the filtered image
      if (toolsValues.flipHorizontal) {
        ctx.scale(-1, 1)
      }
      if (toolsValues.flipVertical) {
        ctx.scale(1, -1)
      }

      ctx.rotate(angle)
      ctx.drawImage(img, -width / 2, -height / 2, width, height)
      ctx.restore()

      // Get the filtered image data
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // Apply exposure adjustment if needed
      if (exposure !== 0) {
        applyExposureEffect(data, exposure)
      }

      // Apply gamma correction if needed
      if (gamma !== 1) {
        applyGammaEffect(data, gamma)
      }

      // Apply temperature adjustment if needed
      if (temperature !== 0) {
        applyTemperatureEffect(data, temperature)
      }

      // Apply vignette effect if needed
      if (vintage > 0) {
        applyVintageEffect(data, width, height, vintage)
      }

      // Apply sharpen effect if needed
      // if (sharpen > 0) {
      //   // Create a temporary canvas for the sharpen effect
      //   const tempCanvas = document.createElement("canvas")
      //   const tempCtx = tempCanvas.getContext("2d")
      //   if (!tempCtx) return

      //   tempCanvas.width = width
      //   tempCanvas.height = height
      //   tempCtx.putImageData(imageData, 0, 0)

      //   // Calculate sharpen intensity (0 to 1)
      //   const intensity = sharpen / 100

      //   // Create sharpen kernel
      //   const kernel = [
      //     -intensity,
      //     -intensity,
      //     -intensity,
      //     -intensity,
      //     1 + 8 * intensity,
      //     -intensity,
      //     -intensity,
      //     -intensity,
      //     -intensity,
      //   ]

      //   // Apply convolution
      //   const tempImageData = tempCtx.getImageData(0, 0, width, height)
      //   const tempData = tempImageData.data

      //   for (let y = 1; y < height - 1; y++) {
      //     for (let x = 1; x < width - 1; x++) {
      //       const i = (y * width + x) * 4

      //       for (let c = 0; c < 3; c++) {
      //         let sum = 0
      //         let k = 0

      //         for (let ky = -1; ky <= 1; ky++) {
      //           for (let kx = -1; kx <= 1; kx++) {
      //             const pos = ((y + ky) * width + (x + kx)) * 4
      //             sum += tempData[pos + c] * kernel[k++]
      //           }
      //         }

      //         data[i + c] = Math.max(0, Math.min(255, sum))
      //       }
      //     }
      //   }
      // }

      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0)
    }

    img.src = imageUrl
  }, [imageUrl, toolsValues])

  return (
    <canvas
      ref={canvas}
      className='max-w-full max-h-full object-contain'
      style={{
        transform: `scale(${toolsValues.zoom / 100})`,
        transformOrigin: "center",
      }}
      {...props}
      id='image-editor-canvas'
    />
  )
}

function applyVintageEffect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  vintage: number
) {
  const vignetteValue = vintage / 100 // Convert to 0-1 range

  for (let i = 0; i < data.length; i += 4) {
    // Calculate distance from center for vignette
    const x = (i / 4) % width
    const y = Math.floor(i / 4 / width)
    const centerX = width / 2
    const centerY = height / 2
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
    const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2)
    const vignetteStrength = 1 - (distance / maxDistance) * vignetteValue

    // Apply vignette darkening
    data[i] *= vignetteStrength // Red
    data[i + 1] *= vignetteStrength // Green
    data[i + 2] *= vignetteStrength // Blue
  }
}

function applyTemperatureEffect(data: Uint8ClampedArray, temperature: number) {
  // Convert temperature to a value between -1 and 1 with reduced intensity
  const tempValue = (temperature / 100) * 0.5 // Reduced by 50%

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    if (tempValue > 0) {
      // Warm adjustment (more subtle)
      data[i] = Math.min(255, r + tempValue * 30) // Reduced red increase
      data[i + 1] = Math.min(255, g + tempValue * 15) // Reduced green increase
      data[i + 2] = Math.max(0, b - tempValue * 20) // Reduced blue decrease
    } else {
      // Cool adjustment (more subtle)
      data[i] = Math.max(0, r + tempValue * 20) // Reduced red decrease
      data[i + 1] = Math.max(0, g + tempValue * 10) // Reduced green decrease
      data[i + 2] = Math.min(255, b - tempValue * 30) // Reduced blue increase
    }
  }
}

function applyGammaEffect(data: Uint8ClampedArray, gamma: number) {
  for (let i = 0; i < data.length; i += 4) {
    // Apply gamma correction to each RGB channel
    data[i] = 255 * (data[i] / 255) ** (1 / gamma) // Red
    data[i + 1] = 255 * (data[i + 1] / 255) ** (1 / gamma) // Green
    data[i + 2] = 255 * (data[i + 2] / 255) ** (1 / gamma) // Blue
  }
}

function applyExposureEffect(data: Uint8ClampedArray, exposure: number) {
  // Convert exposure to a multiplier (0.5 to 2.0 range)
  const exposureMultiplier = 1 + exposure / 100
}

function applyFilters(toolsValues: ImageEditorToolsState) {
  const {
    brightness,
    contrast,
    hue,
    saturation,
    invert,
    sepia,
    grayscale,
    blur,
  } = toolsValues
  return `brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hue}deg) saturate(${saturation}%) invert(${invert}%) sepia(${sepia}%) grayscale(${grayscale}%) blur(${blur}px)`
}
