"use client"

import React from "react"
import { PlusIcon, MinusIcon, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SIDEBAR_TOOLS, TOOL_VALUES } from "@/constants"
import { ImageEditorCanvas } from "@/components/image-editor/canvas.image-editor"
import { ImageEditorSidebar } from "@/components/image-editor/sidebar.image-editor"
import { getEditorTools } from "@/components/image-editor/tools.image-editor"
import {
  imageEditorToolsReducer,
  initialState,
  type ImageEditorToolsActions,
} from "@/components/image-editor/state.image-editor"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { useWebGLDownload } from "@/components/image-editor/useWebGLDownload"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Slider } from "../ui/slider"
import { Label } from "../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Input } from "../ui/input"
import { QualityOptions } from "./quaity-options.image-editor"
import { LayerSystem, type Layer } from "./layer-system"

export interface ImageEditorProps extends React.ComponentProps<"div"> {
  image: File | null
}

export function ImageEditor({ image, ...props }: ImageEditorProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawFnRef = React.useRef<() => void>(() => {})

  const [isOptionsOpen, setIsOptionsOpen] = React.useState(false)
  const [jpegQuality, setJpegQuality] = React.useState(80)
  const [webpQuality, setWebpQuality] = React.useState(80)

  const [selectedSidebar, setSelectedSidebar] =
    React.useState<keyof typeof SIDEBAR_TOOLS>("transform")
  const [selectedTool, setSelectedTool] =
    React.useState<keyof typeof TOOL_VALUES>("rotate")
  const [progress, setProgress] = React.useState(0)

  // Layer system state
  const [layers, setLayers] = React.useState<Layer[]>(() => {
    // Initialize with a default layer
    const defaultLayer: Layer = {
      id: "layer-1",
      name: "Background",
      visible: true,
      locked: false,
      filters: { ...initialState },
      opacity: 100,
    }
    return [defaultLayer]
  })
  const [selectedLayerId, setSelectedLayerId] =
    React.useState<string>("layer-1")

  // Get the currently selected layer's filters
  const selectedLayer = React.useMemo(() => {
    return layers.find((layer) => layer.id === selectedLayerId) || layers[0]
  }, [layers, selectedLayerId])

  const toolsValues = React.useMemo(() => {
    return selectedLayer?.filters || initialState
  }, [selectedLayer])

  const dispatch = React.useCallback(
    (action: ImageEditorToolsActions) => {
      if (!selectedLayer) return

      const newFilters = imageEditorToolsReducer(selectedLayer.filters, action)
      const newLayers = layers.map((layer) =>
        layer.id === selectedLayerId ? { ...layer, filters: newFilters } : layer
      )
      setLayers(newLayers)
    },
    [selectedLayer, selectedLayerId, layers]
  )

  const value = React.useMemo(() => {
    switch (selectedTool) {
      case "rotate":
        return toolsValues.rotate
      case "scale":
        return toolsValues.scale
      case "brightness":
        return toolsValues.brightness
      case "contrast":
        return toolsValues.contrast
      case "hue":
        return toolsValues.hue
      case "saturation":
        return toolsValues.saturation
      case "exposure":
        return toolsValues.exposure
      case "temperature":
        return toolsValues.temperature
      case "gamma":
        return toolsValues.gamma
      case "vintage":
        return toolsValues.vintage
      case "blur":
        return toolsValues.blur
      case "invert":
        return toolsValues.invert
      case "sepia":
        return toolsValues.sepia
      case "grayscale":
        return toolsValues.grayscale
      case "sharpen":
        return toolsValues.sharpen
      case "tint":
        return toolsValues.tint
      case "vibrance":
        return toolsValues.vibrance
      case "noise":
        return toolsValues.noise
      case "grain":
        return toolsValues.grain
      default:
        return 0
    }
  }, [
    selectedTool,
    toolsValues.rotate,
    toolsValues.scale,
    toolsValues.brightness,
    toolsValues.contrast,
    toolsValues.hue,
    toolsValues.saturation,
    toolsValues.exposure,
    toolsValues.temperature,
    toolsValues.gamma,
    toolsValues.vintage,
    toolsValues.blur,
    toolsValues.invert,
    toolsValues.sepia,
    toolsValues.grayscale,
    toolsValues.sharpen,
    toolsValues.tint,
    toolsValues.vibrance,
    toolsValues.noise,
    toolsValues.grain,
  ])

  const handleSelectedToolChange = React.useCallback(
    (tool: keyof typeof TOOL_VALUES) => {
      setSelectedTool(tool)
    },
    []
  )

  const handleSelectedSidebarChange = React.useCallback(
    (sidebar: keyof typeof SIDEBAR_TOOLS) => {
      setSelectedSidebar(sidebar)
    },
    []
  )

  const { header: Header, footer: ImageEditorFooter } = React.useMemo(
    () => getEditorTools(selectedSidebar),
    [selectedSidebar]
  )

  const handleOnProgress = React.useCallback((progress: number) => {
    setProgress(progress)
  }, [])

  const downloadImage = useWebGLDownload(canvasRef, drawFnRef)

  const handleOnDownload = React.useCallback(
    (mimeType: string, quality?: number) => () => {
      downloadImage(mimeType, quality ? quality / 100 : undefined)
    },
    [downloadImage]
  )

  const handleOnUndo = React.useCallback(() => {
    dispatch({ type: "undo" })
  }, [dispatch])

  const handleOnRedo = React.useCallback(() => {
    dispatch({ type: "redo" })
  }, [dispatch])

  const handleDrawReady = React.useCallback((d: () => void) => {
    drawFnRef.current = d
  }, [])

  const handleLayersChange = React.useCallback((newLayers: Layer[]) => {
    setLayers(newLayers)
  }, [])

  const handleSelectedLayerChange = React.useCallback(
    (layerId: string | null) => {
      setSelectedLayerId(layerId || "")
    },
    []
  )

  const handleLayerFiltersChange = React.useCallback(
    (layerId: string, filters: any) => {
      const newLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, filters } : layer
      )
      setLayers(newLayers)
    },
    [layers]
  )

  return (
    <div
      {...props}
      className='grid grid-cols-[80px_1fr_256px] grid-rows-[auto_1fr_auto] gap-x-4 gap-y-2 justify-center'
    >
      <ImageEditorSidebar
        selected={selectedSidebar}
        onSelectedToolChange={handleSelectedToolChange}
        onChange={handleSelectedSidebarChange}
        className='col-start-1 row-start-1 row-end-3'
        dispatch={dispatch}
        progress={progress}
      />

      <div className='col-start-2 row-start-1 w-full flex flex-col'>
        <div className='flex flex-col items-center'>
          <Header
            dispatch={dispatch}
            selectedTool={selectedTool}
            onSelectedToolChange={handleSelectedToolChange}
            toolsValues={toolsValues}
            progress={progress}
          />
        </div>
      </div>

      <div className='col-start-2 row-start-2 flex flex-col items-center overflow-hidden'>
        <div className='flex justify-center items-center w-full overflow-hidden h-[calc(100vh-300px)]'>
          <div className='relative w-full h-full overflow-auto'>
            <div className='absolute inset-0 flex items-center justify-center'>
              <ImageEditorCanvas
                image={image}
                toolsValues={toolsValues}
                layers={layers}
                onProgress={handleOnProgress}
                id='image-editor-canvas'
                canvasRef={canvasRef}
                onDrawReady={handleDrawReady}
              />
            </div>
          </div>
        </div>
      </div>

      <ImageEditorFooter
        image={image}
        dispatch={dispatch}
        selectedTool={selectedTool}
        value={value}
        onSelectedToolChange={handleSelectedToolChange}
        className='col-start-2 row-start-3 mx-auto'
        toolsValues={toolsValues}
        onProgress={handleOnProgress}
        progress={progress}
      />

      <ZoomControls
        className='col-start-1 row-start-3'
        dispatch={dispatch}
        value={toolsValues.zoom}
      />

      <div className='col-start-3 row-start-1 row-end-3'>
        <div className='flex gap-2'>
          <Button onClick={handleOnUndo}>Undo</Button>
          <Button onClick={handleOnRedo}>Redo</Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' className='rounded-full gap-2'>
              Download <ChevronDown className='w-4 h-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <QualityOptions
              description='Configure your download quality. These settings will affect the final file size and image quality of your download.'
              title='JPEG Download Options'
              isOpen={isOptionsOpen}
              setIsOpen={setIsOptionsOpen}
              quality={jpegQuality}
              setQuality={setJpegQuality}
              onClick={handleOnDownload("image/jpeg", jpegQuality)}
            >
              JPEG
            </QualityOptions>
            <QualityOptions
              description='Configure your download quality. These settings will affect the final file size and image quality of your download.'
              title='WebP Download Options'
              isOpen={isOptionsOpen}
              setIsOpen={setIsOptionsOpen}
              quality={webpQuality}
              setQuality={setWebpQuality}
              onClick={handleOnDownload("image/webp", webpQuality)}
            >
              WebP
            </QualityOptions>
            <DropdownMenuItem onClick={handleOnDownload("image/png")}>
              Png
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleOnDownload("image/gif")}>
              Gif
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOnDownload("image/avif")}>
              AVIF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOnDownload("image/ico")}>
              ICO
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Layer System */}
      <LayerSystem
        layers={layers}
        selectedLayerId={selectedLayerId}
        onLayersChange={handleLayersChange}
        onSelectedLayerChange={handleSelectedLayerChange}
        onLayerFiltersChange={handleLayerFiltersChange}
      />
    </div>
  )
}

function ZoomControls({
  className,
  dispatch,
  value,
}: {
  className: string
  dispatch: React.Dispatch<ImageEditorToolsActions>
  value: number
}) {
  const handleZoom = React.useCallback(
    (operator: "plus" | "minus") => () => {
      const payload = operator === "plus" ? value + 25 : value - 25
      if (payload < 13) {
        return
      }

      dispatch({ type: "zoom", payload })
    },
    [value, dispatch]
  )

  return (
    <div className={cn("flex items-center ", className)}>
      <Button
        variant='outline'
        onClick={handleZoom("minus")}
        className='text-xs rounded-l-full p-3'
      >
        <MinusIcon className='w-3 h-3' />
      </Button>{" "}
      <div className='text-xs px-3 border-y h-10 flex items-center'>
        {value}%
      </div>{" "}
      <Button
        variant='outline'
        onClick={handleZoom("plus")}
        className='text-xs rounded-r-full p-3'
      >
        <PlusIcon className='w-3 h-3' />
      </Button>
    </div>
  )
}
