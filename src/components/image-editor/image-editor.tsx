"use client"

import React from "react"
import { PlusIcon, MinusIcon } from "lucide-react"

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

import { LayerSystem, type Layer } from "./layer-system"
import type { BlendMode } from "@/lib/shaders/blend-modes"

export interface ImageEditorProps extends React.ComponentProps<"div"> {
  image: File | null
  onImageDrop?: (file: File) => void
  onDragStateChange?: (isDragging: boolean) => void
}

export function ImageEditor({
  image,
  onImageDrop,
  onDragStateChange,
  ...props
}: ImageEditorProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawFnRef = React.useRef<() => void>(() => {})

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
      isEmpty: true, // Background layer starts empty until image is loaded
      blendMode: "normal", // Default blend mode
    }
    return [defaultLayer]
  })

  const layersMemo = React.useMemo(() => {
    return layers
  }, [layers])

  const [selectedLayerId, setSelectedLayerId] =
    React.useState<string>("layer-1")

  // Track drag state to prevent canvas updates during drag
  const [isDragActive, setIsDragActive] = React.useState(false)

  // Get the currently selected layer's filters
  const selectedLayer = React.useMemo(() => {
    return (
      layersMemo.find((layer) => layer.id === selectedLayerId) || layersMemo[0]
    )
  }, [layersMemo, selectedLayerId])

  const toolsValues = React.useMemo(() => {
    return selectedLayer?.filters || initialState
  }, [selectedLayer])

  const dispatch = React.useCallback(
    (action: ImageEditorToolsActions) => {
      if (!selectedLayer) return

      const newFilters = imageEditorToolsReducer(selectedLayer.filters, action)
      const newLayers = layersMemo.map((layer) =>
        layer.id === selectedLayerId ? { ...layer, filters: newFilters } : layer
      )
      setLayers(newLayers)
    },
    [selectedLayer, selectedLayerId, layersMemo]
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
    () =>
      getEditorTools({
        selectedSidebar,
        canvasRef,
        drawFnRef,
      }),
    [selectedSidebar]
  )

  const handleOnProgress = React.useCallback((progress: number) => {
    setProgress(progress)
  }, [])

  const handleDrawReady = React.useCallback((d: () => void) => {
    drawFnRef.current = d
  }, [])

  const handleLayersChange = React.useCallback(
    (newLayers: Layer[]) => {
      // Allow layer reordering during drag operations, but prevent other changes
      if (isDragActive) {
        // Check if this is just a reordering (same layers, different order)
        const currentLayerIds = layersMemo.map((layer) => layer.id).sort()
        const newLayerIds = newLayers.map((layer) => layer.id).sort()
        const isReordering =
          currentLayerIds.length === newLayerIds.length &&
          currentLayerIds.every((id, index) => id === newLayerIds[index])

        if (isReordering) {
          setLayers(newLayers)
        }
        return
      }
      setLayers(newLayers)
    },
    [isDragActive, layersMemo]
  )

  const handleSelectedLayerChange = React.useCallback(
    (layerId: string | null) => {
      setSelectedLayerId(layerId || "")
    },
    []
  )

  const handleLayerFiltersChange = React.useCallback(
    (layerId: string, filters: any) => {
      const newLayers = layersMemo.map((layer) =>
        layer.id === layerId ? { ...layer, filters } : layer
      )
      setLayers(newLayers)
    },
    [layersMemo]
  )

  const handleLayerBlendModeChange = React.useCallback(
    (layerId: string, blendMode: BlendMode) => {
      const newLayers = layersMemo.map((layer) =>
        layer.id === layerId ? { ...layer, blendMode } : layer
      )
      setLayers(newLayers)
    },
    [layersMemo]
  )

  const handleImageDrop = React.useCallback(
    (file: File) => {
      // Create a new layer with the dropped image
      const newLayer: Layer = {
        id: `layer-${Date.now()}`,
        name: file.name || `Layer ${layers.length + 1}`,
        visible: true,
        locked: false,
        filters: { ...initialState },
        opacity: 100,
        isEmpty: false, // Layer has image content
        image: file, // Attach the image to this layer
        blendMode: "normal", // Default blend mode
      }

      // Add the new layer to the top of the stack
      const newLayers = [newLayer, ...layersMemo]
      setLayers(newLayers)

      // Select the new layer
      setSelectedLayerId(newLayer.id)
    },
    [layersMemo]
  )

  // Update background layer when initial image is provided
  React.useEffect(() => {
    if (image) {
      setLayers((prevLayers) => {
        const updatedLayers = prevLayers.map((layer) =>
          layer.id === "layer-1"
            ? {
                ...layer,
                isEmpty: false, // Background layer now has content
                image: image, // Attach the initial image to background layer
              }
            : layer
        )
        return updatedLayers
      })
    }
  }, [image])

  return (
    <div
      {...props}
      className='grid grid-cols-[80px_1fr_auto] grid-rows-[auto_1fr_auto]  justify-center'
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
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        </div>
      </div>

      <div className='col-start-2 row-start-2 flex flex-col items-center h-[calc(100vh-300px)] overflow-hidden'>
        <div className='relative h-full'>
          <ImageEditorCanvas
            image={image}
            toolsValues={toolsValues}
            layers={layersMemo}
            onProgress={handleOnProgress}
            id='image-editor-canvas'
            canvasRef={canvasRef}
            onDrawReady={handleDrawReady}
            onImageDrop={handleImageDrop}
            isDragActive={isDragActive}
            selectedLayerId={selectedLayerId}
          />
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
        canvasRef={canvasRef}
        drawFnRef={drawFnRef}
      />

      <ZoomControls
        className='col-start-1 row-start-3'
        dispatch={dispatch}
        value={toolsValues.zoom}
      />

      {/* Layer System */}
      <LayerSystem
        layers={layersMemo}
        selectedLayerId={selectedLayerId}
        onLayersChange={handleLayersChange}
        onSelectedLayerChange={handleSelectedLayerChange}
        onLayerFiltersChange={handleLayerFiltersChange}
        onLayerBlendModeChange={handleLayerBlendModeChange}
        className='row-span-3'
        onDragStateChange={(isDragging) => {
          setIsDragActive(isDragging)
          onDragStateChange?.(isDragging)
        }}
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
