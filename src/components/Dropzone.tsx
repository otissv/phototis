"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { ImageIcon, Upload } from "lucide-react"

interface DropzoneProps {
  onFilesAccepted: (files: File[]) => void
  className?: string
  isMultiple?: boolean
}

export function Dropzone({
  onFilesAccepted,
  className,
  isMultiple = false,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setIsDragging(false)
      onFilesAccepted(acceptedFiles)
    },
    [onFilesAccepted]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    multiple: isMultiple,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  })

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
        isDragActive && "border-primary bg-primary/5",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className='flex flex-col items-center gap-4'>
        {isDragActive ? (
          <Upload className='h-12 w-12 text-primary' />
        ) : (
          <ImageIcon className='h-12 w-12 text-muted-foreground' />
        )}
        <div className='space-y-2'>
          <p className='text-lg font-medium'>
            {isDragActive ? "Drop your images here" : "Drag & drop images here"}
          </p>
          <p className='text-sm text-muted-foreground'>
            or click to select files
          </p>
        </div>
      </div>
    </Card>
  )
}
