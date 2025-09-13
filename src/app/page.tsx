"use client"

import { useState, useCallback } from "react"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Dropzone } from "@/components/Dropzone"
import { ImageCard } from "@/components/ImageCard"
import { ImageEditor } from "@/components/image-editor"
import { toast } from "@/ui/sonner"

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
      {/* <nav className='container flex justify-center mx-auto p-4 space-y-8'>
        <ul className='flex gap-4'>
          <li>
            <Button
              variant='outline'
              onClick={() => handleRouteChange("dropzone")}
            >
              Upload
            </Button>
          </li>
        </ul>
        <ul className='flex gap-4'>
          <li>
            <Button
              variant='outline'
              onClick={() => handleRouteChange("gallery")}
            >
              Gallery
            </Button>
          </li>
        </ul>
      </nav> */}

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

  const handleProcess = async (file: File, options: any) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("options", JSON.stringify(options))

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to process image")
      }

      const blob = await response.blob()

      const rename = options.format
        ? `${file.name.replace(/\.[^/.]+$/, "")}.${options.format}`
        : file.name

      const processedFile = new File([blob], `${rename}`, {
        type: blob.type,
      })

      setImages((prev) =>
        prev.map((img) => (img === file ? processedFile : img))
      )

      return processedFile
    } catch (error) {
      console.error("Error processing image:", error)
    }
  }

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

  const handleNotify = (props: { message: string; title: string }) => {
    toast.error({ message: props.message, title: props.title })
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
        />
      )
  }
}
