"use client"

import React from "react"
import {
  ChevronDown,
  Droplets,
  Eclipse,
  Image,
  Palette,
  Sparkles,
  Sun,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import {
  BLEND_MODE_NAMES,
  type BlendMode,
} from "@/lib/shaders/blend-modes/blend-modes"
import { useEditorContext } from "@/lib/editor/context"
import { TOOL_VALUES } from "@/lib/tools/tools"

import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"

import { DocumentLayerItem } from "./document-layer"
import { DraggableLayerItem } from "@/components/layers/draggable-layer"

export type LayerContextType = {
  isGlobalDragActive: React.RefObject<boolean>
  dropHandled: React.RefObject<boolean>
}

export const layerContextDefaultValue: LayerContextType = {
  isGlobalDragActive: { current: false },
  dropHandled: { current: false },
}

export const LayerContext = React.createContext<LayerContextType>(
  layerContextDefaultValue
)

export interface LayersPanelProps extends React.ComponentProps<"div"> {
  setSelectedSidebar: (sidebar: keyof typeof SIDEBAR_TOOLS) => void
  allowAddMultipleImages?: boolean
}

export function LayersPanelInner({
  className,
  setSelectedSidebar,
  allowAddMultipleImages = false,
  ...props
}: LayersPanelProps) {
  const { isGlobalDragActive } = React.useContext(LayerContext)

  const {
    getOrderedLayers,
    getSelectedLayerId,
    selectLayer,
    addEmptyLayer,
    addImageLayer,
    removeLayer,
    duplicateLayer,
    reorderLayers,
    setBlendMode,
    toggleVisibility,
    toggleLock,
    setLayerName,
    setOpacity,
    addAdjustmentLayer,
    ungroupLayer,
    toggleGroupCollapse,
    state,
  } = useEditorContext()

  const layers = getOrderedLayers()
  const selectedLayerId = getSelectedLayerId()
  const isDragActive = state.ephemeral.interaction.isDragging

  const handleFileUpload = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isDragActive || isGlobalDragActive.current) return

      const files = event.target.files
      if (!files || files.length === 0) return

      // Convert FileList to Array and filter for image files
      const fileArray = Array.from(files)
      const imageFiles = fileArray.filter((file) =>
        file.type.startsWith("image/")
      )

      if (imageFiles.length === 0) {
        console.warn("No valid image files selected")
        return
      }

      // Create new layers with all uploaded images
      addImageLayer(imageFiles)

      // Reset the input value to allow selecting the same files again
      event.target.value = ""
    },
    [addImageLayer, isDragActive, isGlobalDragActive.current]
  )

  const handleDeleteLayer = React.useCallback(
    (layerId: string) => {
      if (isDragActive) return
      removeLayer(layerId)
    },
    [isDragActive, removeLayer]
  )

  const handleDuplicateLayer = React.useCallback(
    (layerId: string) => {
      if (isDragActive) return
      duplicateLayer(layerId)
    },
    [duplicateLayer, isDragActive]
  )

  const handleToggleVisibility = React.useCallback(
    (layerId: string) => {
      if (isDragActive) return
      toggleVisibility(layerId)
    },
    [toggleVisibility, isDragActive]
  )

  const handleToggleLock = React.useCallback(
    (layerId: string) => {
      if (isDragActive) return
      toggleLock(layerId)
    },
    [toggleLock, isDragActive]
  )

  const handleLayerNameChange = React.useCallback(
    (layerId: string, name: string) => {
      if (isDragActive) return
      setLayerName(layerId, name)
    },
    [setLayerName, isDragActive]
  )

  const handleOpacityChange = React.useCallback(
    (layerId: string, opacity: number) => {
      if (isDragActive) return
      let value = opacity
      if (opacity < 0) {
        value = 0
      } else if (opacity > 100) {
        value = 100
      }
      setOpacity(layerId, value)
    },
    [setOpacity, isDragActive]
  )

  const handleMoveLayer = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderLayers(fromIndex, toIndex)
    },
    [reorderLayers]
  )

  const handleAddAdjustmentLayer = React.useCallback(
    (adjustmentType: string) => {
      // Default parameters for each adjustment type
      const defaultParams: Record<string, Record<string, any>> = {
        brightness: {
          brightness: TOOL_VALUES.brightness.defaultValue as number,
        },
        contrast: { contrast: TOOL_VALUES.contrast.defaultValue as number },
        exposure: { exposure: TOOL_VALUES.exposure.defaultValue as number },
        gamma: { gamma: TOOL_VALUES.gamma.defaultValue as number },
        hue: { hue: TOOL_VALUES.hue.defaultValue as number },
        saturation: {
          saturation: TOOL_VALUES.saturation.defaultValue as number,
        },
        temperature: {
          temperature: TOOL_VALUES.temperature.defaultValue as number,
        },
        recolor: {
          recolorHue: (TOOL_VALUES as any).recolorHue.defaultValue,
          recolorSaturation: (TOOL_VALUES as any).recolorSaturation
            .defaultValue,
          recolorLightness: (TOOL_VALUES as any).recolorLightness.defaultValue,
          recolorAmount: (TOOL_VALUES as any).recolorAmount.defaultValue,
          recolorPreserveLum: (TOOL_VALUES as any).recolorPreserveLum
            .defaultValue,
        },
        vibrance: { vibrance: TOOL_VALUES.vibrance.defaultValue as number },
        vintage: { vintage: TOOL_VALUES.vintage.defaultValue as number },
        grayscale: { grayscale: TOOL_VALUES.grayscale.defaultValue as number },
        invert: { invert: TOOL_VALUES.invert.defaultValue as number },
        sepia: { sepia: TOOL_VALUES.sepia.defaultValue as number },
        solid: { solid: (TOOL_VALUES.solid as any).defaultValue.color },
      }

      addAdjustmentLayer(adjustmentType, defaultParams[adjustmentType], "top")
    },
    [addAdjustmentLayer]
  )

  const handleUngroupLayer = React.useCallback(
    (layerId: string) => {
      if (isDragActive) return
      ungroupLayer(layerId)
    },
    [ungroupLayer, isDragActive]
  )

  const handleToggleGroupCollapse = React.useCallback(
    (layerId: string) => {
      if (isDragActive) return
      toggleGroupCollapse(layerId)
    },
    [toggleGroupCollapse, isDragActive]
  )

  const currentLayer = React.useMemo(() => {
    return layers.find((layer) => layer.id === selectedLayerId)
  }, [layers, selectedLayerId])

  const isDocumentLayerSelected = selectedLayerId === "document"

  return (
    <div className={cn("w-full space-y-2", className)} {...props}>
      <div className='flex items-center  h-12 p-2 text-xs justify-between border-b gap-2'>
        <div className='flex items-center gap-1'>
          <div className='text-xs'>Blend:</div>
          {/* Blend Mode Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className='h-8 px-2 text-xs'
                disabled={
                  isDragActive ||
                  isGlobalDragActive.current ||
                  isDocumentLayerSelected
                }
              >
                <span className='whitespace-nowrap'>
                  {currentLayer?.blendMode
                    ? BLEND_MODE_NAMES[currentLayer.blendMode]
                    : "Normal"}
                </span>
                <ChevronDown className='w-3 h-3 ml-1' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='bg-background p-2 border rounded-sm flex flex-col'>
              {Object.entries(BLEND_MODE_NAMES).map(([mode, name]) => (
                <Button
                  key={mode}
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start whitespace-nowrap'
                  onClick={() =>
                    selectedLayerId &&
                    setBlendMode(selectedLayerId, mode as BlendMode)
                  }
                >
                  {name}
                </Button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Opacity Control */}
        <div className='flex items-center gap-2'>
          <span className='text-xs'>Opacity:</span>
          <div className='flex items-center border rounded-sm h-9'>
            <Input
              type='number'
              min='0'
              max='100'
              value={currentLayer?.opacity ?? 100}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleOpacityChange(
                  selectedLayerId as string,
                  Number(e.target.value)
                )
              }
              className=' px-2 py-1 h-8 border-none'
              disabled={
                isDragActive ||
                isGlobalDragActive.current ||
                isDocumentLayerSelected
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='size-8 p-0 rounded-sm'
                  disabled={
                    isDragActive ||
                    isGlobalDragActive.current ||
                    isDocumentLayerSelected
                  }
                >
                  <ChevronDown className='w-3 h-3' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <div className='z-10 flex items-center gap-2 border rounded-sm h-10 bg-background p-2'>
                  <input
                    type='range'
                    min='0'
                    max='100'
                    value={currentLayer?.opacity || 0}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleOpacityChange(
                        selectedLayerId as string,
                        Number(e.target.value)
                      )
                    }
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                    onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
                    className='h-1 bg-secondary rounded-lg appearance-none cursor-pointer'
                    disabled={isDragActive || isGlobalDragActive.current}
                  />
                  <span className='text-xs w-8'>
                    {currentLayer?.opacity || 0}%
                  </span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className='space-y-2 px-2 transition-all'>
        {layers.map((layer, index) => {
          return layer.type !== "document" ? (
            <DraggableLayerItem
              key={layer.id}
              layer={layer}
              index={index}
              type='layer'
              isSelected={selectedLayerId === layer.id}
              onSelect={() => selectLayer(layer.id)}
              onDelete={() => handleDeleteLayer(layer.id)}
              onDuplicate={() => handleDuplicateLayer(layer.id)}
              onToggleVisibility={() => handleToggleVisibility(layer.id)}
              onToggleLock={() => handleToggleLock(layer.id)}
              onNameChange={(name) => handleLayerNameChange(layer.id, name)}
              onOpacityChange={(opacity) =>
                handleOpacityChange(layer.id, opacity)
              }
              onMoveLayer={handleMoveLayer}
              onUngroup={() => handleUngroupLayer(layer.id)}
              onToggleGroupCollapse={() => handleToggleGroupCollapse(layer.id)}
            />
          ) : null
        })}

        <DocumentLayerItem
          isSelected={selectedLayerId === "document"}
          layer={layers[1]}
          setSelectedSidebar={setSelectedSidebar}
        />
      </div>

      <div className='flex items-center gap-1 border-t border-border p-2'>
        {/* File upload button */}
        <div className='relative h-8 w-8 p-0 flex items-center justify-center rounded-sm hover:bg-muted'>
          <Image className='w-4 h-4' />
          <input
            type='file'
            accept='image/*'
            onChange={handleFileUpload}
            className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
            disabled={isDragActive || isGlobalDragActive.current}
            title='Upload image to new layer'
            multiple={allowAddMultipleImages}
          />
        </div>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                title='Add adjustment layer'
                variant='ghost'
                size='sm'
                className='h-8 w-8 p-0 rounded-sm'
                disabled={isDragActive || isGlobalDragActive.current}
              >
                <Eclipse className='w-4 h-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='bg-background p-2 border rounded-sm'>
              <div className='grid grid-cols-2 gap-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("brightness")}
                >
                  <Sun className='w-3 h-3 mr-1' />
                  Brightness
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("contrast")}
                >
                  <Palette className='w-3 h-3 mr-1' />
                  Contrast
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("exposure")}
                >
                  <Sun className='w-3 h-3 mr-1' />
                  Exposure
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("gamma")}
                >
                  <Palette className='w-3 h-3 mr-1' />
                  Gamma
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("hue")}
                >
                  <Droplets className='w-3 h-3 mr-1' />
                  Hue
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("saturation")}
                >
                  <Droplets className='w-3 h-3 mr-1' />
                  Saturation
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("temperature")}
                >
                  <Droplets className='w-3 h-3 mr-1' />
                  Temperature
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("vibrance")}
                >
                  <Sparkles className='w-3 h-3 mr-1' />
                  Vibrance
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("grayscale")}
                >
                  <Eclipse className='w-3 h-3 mr-1' />
                  Grayscale
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("sepia")}
                >
                  <Eclipse className='w-3 h-3 mr-1' />
                  Sepia
                </Button>

                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("solid")}
                >
                  <Palette className='w-3 h-3 mr-1' />
                  Solid Color
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("recolor")}
                >
                  <Palette className='w-3 h-3 mr-1' />
                  Recolor
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs h-8 justify-start rounded-sm'
                  onClick={() => handleAddAdjustmentLayer("invert")}
                >
                  <Eclipse className='w-3 h-3 mr-1' />
                  Invert
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant='ghost'
          size='sm'
          className='h-8 w-8 p-0 rounded-sm'
          onClick={() => handleAddAdjustmentLayer("mask")}
        >
          <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            aria-hidden='true'
            className='size-5'
          >
            <rect
              x='3'
              y='4'
              width='20'
              height='16'
              rx='3'
              ry='3'
              fill='none'
              stroke='currentColor'
              strokeWidth='1'
            />
            <circle cx='13' cy='12' r='4' fill='currentColor' />
          </svg>
        </Button>

        <div className='text-xs ml-auto text-muted-foreground'>
          {layers.length === 1 ? "1 layer" : `${layers.length} layers`}
        </div>
      </div>
    </div>
  )
}

export function LayersPanel(props: LayersPanelProps) {
  const isGlobalDragActive = React.useRef(false)
  const dropHandled = React.useRef(false)
  return (
    <LayerContext.Provider value={{ isGlobalDragActive, dropHandled }}>
      <LayersPanelInner {...props} />
    </LayerContext.Provider>
  )
}
