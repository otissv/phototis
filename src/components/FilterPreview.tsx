import React from "react"
import { cn } from "@/lib/utils"
import type { ImageEditorToolsState } from "./image-editor.state"

interface FilterPreviewProps extends React.ComponentProps<"canvas"> {
  className?: string
  image: File
  filterValues: Partial<ImageEditorToolsState>
}

export function FilterPreview({
  className,
  image,
  filterValues,
}: FilterPreviewProps) {
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
      // Set canvas dimensions
      const width = 100
      const height = 100
      ctx.canvas.width = width
      ctx.canvas.height = height

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw image
      ctx.drawImage(img, 0, 0, width, height)

      // Apply filters
      const {
        brightness = 100,
        contrast = 100,
        saturation = 100,
        hue = 0,
        exposure = 0,
        temperature = 0,
        gamma = 1,
        vintage = 0,
        blur = 0,
        invert = 0,
        sepia = 0,
        grayscale = 0,
        tint = 0,
        vibrance = 0,
        noise = 0,
        grain = 0,
      } = filterValues

      // Apply CSS filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) invert(${invert}%) sepia(${sepia}%) grayscale(${grayscale}%) blur(${blur}px)`

      // Get the filtered image data
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // Apply exposure adjustment if needed
      if (exposure !== 0) {
        const exposureMultiplier = 1 + exposure / 100
        for (let i = 0; i < data.length; i += 4) {
          data[i] *= exposureMultiplier // Red
          data[i + 1] *= exposureMultiplier // Green
          data[i + 2] *= exposureMultiplier // Blue
        }
      }

      // Apply gamma correction if needed
      if (gamma !== 1) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 * (data[i] / 255) ** (1 / gamma) // Red
          data[i + 1] = 255 * (data[i + 1] / 255) ** (1 / gamma) // Green
          data[i + 2] = 255 * (data[i + 2] / 255) ** (1 / gamma) // Blue
        }
      }

      // Apply temperature adjustment if needed
      if (temperature !== 0) {
        const tempValue = (temperature / 100) * 0.5
        for (let i = 0; i < data.length; i += 4) {
          if (tempValue > 0) {
            data[i] = Math.min(255, data[i] + tempValue * 30) // Red
            data[i + 1] = Math.min(255, data[i + 1] + tempValue * 15) // Green
            data[i + 2] = Math.max(0, data[i + 2] - tempValue * 20) // Blue
          } else {
            data[i] = Math.max(0, data[i] + tempValue * 20) // Red
            data[i + 1] = Math.max(0, data[i + 1] + tempValue * 10) // Green
            data[i + 2] = Math.min(255, data[i + 2] - tempValue * 30) // Blue
          }
        }
      }

      // Apply vintage effect if needed
      if (vintage > 0) {
        const vignetteValue = vintage / 100
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % width
          const y = Math.floor(i / 4 / width)
          const centerX = width / 2
          const centerY = height / 2
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
          const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2)
          const vignetteStrength = 1 - (distance / maxDistance) * vignetteValue

          data[i] *= vignetteStrength // Red
          data[i + 1] *= vignetteStrength // Green
          data[i + 2] *= vignetteStrength // Blue
        }
      }

      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0)
    }

    img.src = imageUrl
  }, [imageUrl, filterValues])

  return (
    <canvas
      ref={canvas}
      className={cn("w-full h-full object-cover", className)}
    />
  )
}
