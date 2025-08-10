"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

interface ImageOptions {
  width?: number
  height?: number
  format?: "png" | "webp" | "gif" | "avif" | "ico" | "jpeg"
  rotate?: number
  flip?: boolean
}

export interface ImageCardProps {
  image: File
  onProcess: (file: File, options: ImageOptions) => Promise<File | undefined>
  onDownload: (file: File) => void
  setRoute: (route: "gallery" | "editor") => void
  setSelectedImage: (image: File) => void
}
export function ImageCard({
  image,
  onProcess,
  onDownload,
  setRoute,
  setSelectedImage,
}: ImageCardProps) {
  const [format, setFormat] = useState<ImageOptions["format"]>()

  const [isProcessing, setIsProcessing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>("")

  // Create a single object URL for the preview and revoke it on change/unmount
  useEffect(() => {
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [image])

  const handleProcess = async () => {
    setIsProcessing(true)
    try {
      await onProcess(image, {
        format,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadAs = (format: ImageOptions["format"]) => async () => {
    setIsProcessing(true)
    try {
      const processedFile = await onProcess(image, {
        format,
      })

      if (!processedFile) return

      onDownload(processedFile)
    } finally {
      // setFormat("jpeg")
      setIsProcessing(false)
    }
  }

  const handleCardClick = () => {
    setSelectedImage(image)
    setRoute("editor")
  }

  return (
    <Card className='w-full max-w-sm rounded-md'>
      <CardContent className='p-4'>
        <div
          className='relative aspect-square w-full overflow-hidden rounded-md'
          onClick={handleCardClick}
          onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
          tabIndex={0}
          // biome-ignore lint/a11y/useSemanticElements: <explanation>
          role='button'
        >
          <img
            src={previewUrl}
            alt={image.name}
            className='h-full w-full object-cover'
          />
        </div>
      </CardContent>
      <CardFooter className='block p-4'>
        <div className='flex w-full border rounded-md'>
          <Button
            title='Download'
            variant='ghost'
            onClick={() => onDownload(image)}
            disabled={isProcessing}
            className='flex-1 rounded-l-md'
          >
            Download
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                title='Download As'
                variant='ghost'
                disabled={isProcessing}
                className='rounded-r-md'
              >
                <ChevronDown className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("jpeg")}
                  className='w-full justify-start rounded-md text-xs'
                >
                  jpeg
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("png")}
                  className='w-full justify-start rounded-md text-xs    '
                >
                  png
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("webp")}
                  className='w-full justify-start rounded-md text-xs'
                >
                  webp
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("gif")}
                  className='w-full justify-start rounded-md text-xs'
                >
                  gif
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("avif")}
                  className='w-full justify-start rounded-md text-xs'
                >
                  avif
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("ico")}
                  className='w-full justify-start rounded-md text-xs'
                >
                  ico
                </Button>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem className='p-0'>
                <Button
                  variant='ghost'
                  onClick={handleDownloadAs("ico")}
                  className='w-full justify-start rounded-md text-xs'
                >
                  More...
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  )
}
