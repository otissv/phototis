"use client"

import { useState } from "react"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Dropzone } from "@/components/Dropzone"
import { ImageCard } from "@/components/ImageCard"
import { Button } from "@/components/ui/button"
import { ImageEditor } from "@/components/image-editor/image-editor"
import SlidingTrack from "@/components/sliding-track"

export default function Home() {
  const [route, setRoute] = useState<"gallery" | "editor" | "dropzone">(
    "dropzone"
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <nav className='container flex justify-center mx-auto p-4 space-y-8'>
        <ul className='flex gap-4'>
          <li>
            <Button variant='outline' onClick={() => setRoute("dropzone")}>
              Upload
            </Button>
          </li>
        </ul>
        <ul className='flex gap-4'>
          <li>
            <Button variant='outline' onClick={() => setRoute("gallery")}>
              Gallery
            </Button>
          </li>
        </ul>
      </nav>

      <main className='container mx-auto px-4 space-y-8'>
        <Router route={route} setRoute={setRoute} />
      </main>
    </DndProvider>
  )
}

interface RouterProps {
  route: "gallery" | "editor" | "dropzone"
  setRoute: (route: "gallery" | "editor" | "dropzone") => void
}

function Router({ route, setRoute }: RouterProps) {
  const [images, setImages] = useState<File[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const handleFilesAccepted = (files: File[]) => {
    setImages((prev) => [...prev, ...files])
  }

  const handleOnImageDelete = (image: File) => {
    const newImagesList = images.filter((img: File) => img.name !== image.name)
    setImages(newImagesList)
  }

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

  switch (route) {
    case "dropzone":
      return (
        <div>
          <Dropzone
            onFilesAccepted={(files) => {
              setImages((prev) => [...prev, ...files])
              setSelectedImage(files[0])
              setRoute("editor")
            }}
            className='rounded-md h-160'
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
            />
          </div>

          <div className='w-full flex flex-wrap overflow-y-auto'>
            {images.map((image) => (
              <div
                key={`${image.name}-${image.lastModified}`}
                className='pl-1 w-full md:basis-1/3 lg:basis-1/4'
              >
                <ImageCard
                  key={`${image.name}-${image.lastModified}`}
                  image={image}
                  onProcess={handleProcess}
                  onDownload={handleDownload}
                  onDelete={handleOnImageDelete}
                  setRoute={setRoute}
                  setSelectedImage={setSelectedImage}
                />
              </div>
            ))}
          </div>
        </div>
      )
    case "editor":
      return <ImageEditor image={selectedImage} />
  }
}
