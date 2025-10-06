"use client"

import { useState, useCallback } from "react"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Dropzone } from "@/components/Dropzone"
import { ImageEditor } from "@/components/image-editor"
import { toast } from "@/ui/sonner"

import { brightness } from "@/lib/adjustments/plugins/plugin.brightness"
import { contrast } from "@/lib/adjustments/plugins/plugin.contrast"
import { exposure } from "@/lib/adjustments/plugins/plugin.exposure"
import { gamma } from "@/lib/adjustments/plugins/plugin.gamma"
import { hue } from "@/lib/adjustments/plugins/plugin.hue"
import { saturation } from "@/lib/adjustments/plugins/plugin.saturation"
import { temperature } from "@/lib/adjustments/plugins/plugin.temperature"
import { vibrance } from "@/lib/adjustments/plugins/plugin.vibrance"
import { vintage } from "@/lib/adjustments/plugins/plugin.vintage"
import { grayscale } from "@/lib/adjustments/plugins/plugin.grayscale"
import { invert } from "@/lib/adjustments/plugins/plugin.invert"
import { sepia } from "@/lib/adjustments/plugins/plugin.sepia"
import { noise } from "@/lib/adjustments/plugins/plugin.noise"
import { grain } from "@/lib/adjustments/plugins/plugin.grain"
import { colorize } from "@/lib/adjustments/plugins/plugin.colorize"
import { solid } from "@/lib/adjustments/plugins/plugin.solid"
import { tintPlugin as tint } from "@/lib/adjustments/plugins/plugin.tint"
import { sharpen } from "@/lib/adjustments/plugins/plugin.sharpen"
import { gaussian } from "@/lib/adjustments/plugins/plugin.gaussian"

const adjustmentPlugins = [
  brightness,
  contrast,
  exposure,
  gamma,
  hue,
  saturation,
  temperature,
  vibrance,
  vintage,
  grayscale,
  invert,
  sepia,
  noise,
  // grain,
  colorize,
  solid,
  tint,
  sharpen,
  gaussian,
]

// Global drag state to prevent conflicts
let globalDragActive = false

// Function to update global drag state
const setGlobalDragActive = (active: boolean) => {
  globalDragActive = active
}

export default function Home() {
  const [route, setRoute] = useState<"gallery" | "editor" | "dropzone">(
    "dropzone"
  )

  const handleRouteChange = useCallback(
    (newRoute: "gallery" | "editor" | "dropzone") => {
      setRoute(newRoute)
    },
    []
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <main className='h-full relative'>
        <Router route={route} setRoute={handleRouteChange} />
      </main>
    </DndProvider>
  )
}

interface RouterProps {
  route: "gallery" | "editor" | "dropzone"
  setRoute: (route: "gallery" | "editor" | "dropzone") => void
}

const MULTIPLE_IMAGE_UPLOAD = true

function Router({ route, setRoute }: RouterProps) {
  const [images, setImages] = useState<File[]>([])
  const [selectedImages, setSelectedImages] = useState<File[]>([])

  const handleDownload = (file: File, rename?: string) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = rename || file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  switch (route) {
    case "dropzone":
      return (
        <div>
          <Dropzone
            onFilesAccepted={(files) => {
              setImages((prev) => [...prev, ...files])
              setSelectedImages(files)
              setRoute("editor")
            }}
            className='rounded-md h-160'
            onDragStateChange={setGlobalDragActive}
            isMultiple={MULTIPLE_IMAGE_UPLOAD}
          />
        </div>
      )
    case "gallery":
      return (
        <div className='space-y-4'>
          <div>
            <p className='text-muted-foreground'>
              Upload and process your images with ease
            </p>

            <Dropzone
              onFilesAccepted={(files) =>
                setImages((prev) => [...prev, ...files])
              }
              className='rounded-md'
              isMultiple={MULTIPLE_IMAGE_UPLOAD}
            />
          </div>
        </div>
      )
    case "editor":
      return (
        <ImageEditor
          images={selectedImages}
          onDragStateChange={setGlobalDragActive}
          notify={toast.error}
          allowAddMultipleImages={MULTIPLE_IMAGE_UPLOAD}
          adjustmentPlugins={adjustmentPlugins}
        />
      )
  }
}
