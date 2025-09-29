"use client"

import { useCallback, useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { ImageIcon, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card } from "@/ui/card"

interface DropzoneProps {
  onFilesAccepted: (files: File[]) => void
  className?: string
  isMultiple?: boolean
  onDragStateChange?: (isDragging: boolean) => void
}

export function Dropzone({
  onFilesAccepted,
  className,
  isMultiple = false,
  onDragStateChange,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingDrop, setIsProcessingDrop] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Prevent multiple drop processing
      if (isProcessingDrop) return

      setIsProcessingDrop(true)
      setIsDragging(false)

      // Add a small delay to ensure React DnD cleanup
      setTimeout(() => {
        onFilesAccepted(acceptedFiles)
        setIsProcessingDrop(false)
      }, 100)
    },
    [onFilesAccepted, isProcessingDrop]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    multiple: isMultiple,
    onDragEnter: () => {
      setIsDragging(true)
      onDragStateChange?.(true)
    },
    onDragLeave: () => {
      setIsDragging(false)
      onDragStateChange?.(false)
    },
  })

  // Cleanup on unmount to prevent React DnD issues
  useEffect(() => {
    return () => {
      setIsDragging(false)
      setIsProcessingDrop(false)
      onDragStateChange?.(false)
    }
  }, [onDragStateChange])

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
        isDragActive && "border-primary bg-primary/5",
        isProcessingDrop && "pointer-events-none opacity-50",
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
            {isProcessingDrop
              ? "Processing..."
              : isDragActive
                ? "Drop your images here"
                : "Drag & drop images here"}
          </p>
          <p className='text-sm text-muted-foreground'>
            {isProcessingDrop ? "Please wait..." : "or click to select files"}
          </p>
        </div>
      </div>
    </Card>
  )
}
