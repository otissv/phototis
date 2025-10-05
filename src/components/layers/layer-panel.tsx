"use client"

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ComponentProps,
  type RefObject,
} from "react"
import { Image } from "lucide-react"
import { useDrop } from "react-dnd"
import { BlendModesControls } from "@/components/layers/blend-modes-controls"
import {
  DraggableLayerItem,
  type DragItem,
} from "@/components/layers/draggable-layer"
import { OpacityControls } from "@/components/layers/opacity-controls"
import { useEditorContext } from "@/lib/editor/context"
import { useBlendModeChange } from "@/components/hooks/useBlendModeChange"
import { useOpacityChange } from "@/components/hooks/useOpacityChange"
import type {
  ImageEditorToolsActions,
  ImageEditorToolsState,
} from "@/lib/tools/tools-state"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import type { Collapsible } from "@/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { DocumentPanel } from "@/components/layers/document-panel"
import { FxLayersMenu } from "@/components/layers/Fx-layers-menu"
import { AdjustmentLayersMenu } from "@/components/layers/adjustment-layers-menu"

export type LayerContextType = {
  isGlobalDragActive: RefObject<boolean>
  dropHandled: RefObject<boolean>
}

export const layerContextDefaultValue: LayerContextType = {
  isGlobalDragActive: { current: false },
  dropHandled: { current: false },
}

export const LayerContext = createContext<LayerContextType>(
  layerContextDefaultValue
)

export interface LayerItemProps extends ComponentProps<typeof Collapsible> {
  triggerClassName?: string
  contentClassName?: string
}

export interface LayersPanelInnerProps
  extends Omit<LayersPanelProps, "toolsValues" | "dispatch"> {
  allowAddMultipleImages?: boolean
}

export function LayersPanelInner({
  className,
  allowAddMultipleImages = false,
  ...props
}: LayersPanelInnerProps) {
  const { isGlobalDragActive } = useContext(LayerContext)

  const {
    state,
    toolValues,
    addAdjustmentLayer,
    addImageLayer,
    duplicateLayer,
    getOrderedLayers,
    getSelectedLayerId,
    removeLayer,
    reorderLayer,
    reorderLayers,
    selectLayer,
    setLayerName,
    toggleGroupCollapse,
    toggleLock,
    toggleVisibility,
    ungroupLayer,
  } = useEditorContext()

  const layers = getOrderedLayers()
  const selectedLayerId = getSelectedLayerId()
  const isDragActive = state.ephemeral.interaction.isDragging

  // Top-level drop zones to allow promoting child layers out of groups
  const [{ isOverTop }, topDrop] = useDrop({
    accept: ["layer", "group-layer"] as any,
    drop: (item: DragItem) => {
      // Move dragged item to top-level at index 0
      reorderLayer(item.id, { parentId: null, index: 0 })
    },
    collect: (monitor) => ({ isOverTop: monitor.isOver() }),
  })

  const [{ isOverBottom }, bottomDrop] = useDrop({
    accept: ["layer", "group-layer"] as any,
    drop: (item: DragItem) => {
      // Insert just above the document layer (end of user layers)
      reorderLayer(item.id, {
        parentId: null,
        index: Math.max(0, layers.length - 1),
      })
    },
    collect: (monitor) => ({ isOverBottom: monitor.isOver() }),
  })

  const handleFileUpload = useCallback(
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

  const handleDeleteLayer = useCallback(
    (layerId: string) => {
      if (isDragActive) return
      removeLayer(layerId)
    },
    [isDragActive, removeLayer]
  )

  const handleDuplicateLayer = useCallback(
    (layerId: string) => {
      if (isDragActive) return
      duplicateLayer(layerId)
    },
    [duplicateLayer, isDragActive]
  )

  const handleToggleVisibility = useCallback(
    (layerId: string) => {
      if (isDragActive) return
      toggleVisibility(layerId)
    },
    [toggleVisibility, isDragActive]
  )

  const handleToggleLock = useCallback(
    (layerId: string) => {
      if (isDragActive) return
      toggleLock(layerId)
    },
    [toggleLock, isDragActive]
  )

  const handleLayerNameChange = useCallback(
    (layerId: string, name: string) => {
      if (isDragActive) return
      setLayerName(layerId, name)
    },
    [setLayerName, isDragActive]
  )

  const handleBlendModeChange = useBlendModeChange({ isDragActive })
  const handleOpacityChange = useOpacityChange({ isDragActive })

  const handleMoveLayer = useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderLayers(fromIndex, toIndex)
    },
    [reorderLayers]
  )

  const handleAddAdjustmentLayer = useCallback(
    (adjustmentType: string) => {
      // Default parameters for each adjustment type
      const defaultParams: Record<string, Record<string, any>> = {
        brightness: {
          brightness: toolValues.brightness.defaultValue as number,
        },
        contrast: { contrast: toolValues.contrast.defaultValue as number },
        exposure: { exposure: toolValues.exposure.defaultValue as number },
        gamma: { gamma: toolValues.gamma.defaultValue as number },
        hue: { hue: toolValues.hue.defaultValue as number },
        saturation: {
          saturation: toolValues.saturation.defaultValue as number,
        },
        temperature: {
          temperature: toolValues.temperature.defaultValue as number,
        },
        colorize: {
          colorizeHue: (toolValues as any).colorizeHue.defaultValue,
          colorizeSaturation: (toolValues as any).colorizeSaturation
            .defaultValue,
          colorizeLightness: (toolValues as any).colorizeLightness.defaultValue,
          colorizeAmount: (toolValues as any).colorizeAmount.defaultValue,
          colorizePreserveLum: (toolValues as any).colorizePreserveLum
            .defaultValue,
        },
        vibrance: { vibrance: toolValues.vibrance.defaultValue as number },
        vintage: { vintage: toolValues.vintage.defaultValue as number },
        grayscale: { grayscale: toolValues.grayscale.defaultValue as number },
        invert: { invert: toolValues.invert.defaultValue as number },
        sepia: { sepia: toolValues.sepia.defaultValue as number },
        solid: { solid: (toolValues.solid as any).defaultValue },
        sharpen: {
          sharpenAmount: (toolValues as any).sharpenAmount.defaultValue,
          sharpenRadius: (toolValues as any).sharpenRadius.defaultValue,
          sharpenThreshold: (toolValues as any).sharpenThreshold.defaultValue,
        },
        noise: {
          noiseAmount: (toolValues as any).noiseAmount.defaultValue,
          noiseSize: (toolValues as any).noiseSize.defaultValue,
        },
        gaussian: {
          gaussianAmount: (toolValues as any).gaussianAmount.defaultValue,
          gaussianRadius: (toolValues as any).gaussianRadius.defaultValue,
        },
      }

      addAdjustmentLayer(adjustmentType, defaultParams[adjustmentType], "top")
    },
    [toolValues, addAdjustmentLayer]
  )

  const handleUngroupLayer = useCallback(
    (layerId: string) => {
      if (isDragActive) return
      ungroupLayer(layerId)
    },
    [ungroupLayer, isDragActive]
  )

  const handleToggleGroupCollapse = useCallback(
    (layerId: string) => {
      if (isDragActive) return
      toggleGroupCollapse(layerId)
    },
    [toggleGroupCollapse, isDragActive]
  )

  const isDocumentLayerSelected = selectedLayerId === "document"

  return (
    <div className={cn("w-full space-y-2", className)} {...props}>
      <div className='flex items-center  h-12 p-2 text-xs justify-between border-b gap-2'>
        <BlendModesControls
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive.current}
          isDocumentLayerSelected={isDocumentLayerSelected}
          handleBlendModeChange={handleBlendModeChange}
          selectedLayerId={selectedLayerId}
        />

        <OpacityControls
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive.current}
          isDocumentLayerSelected={isDocumentLayerSelected}
          selectedLayerId={selectedLayerId}
          handleOpacityChange={handleOpacityChange}
        />
      </div>

      <div className='space-y-2 px-2 transition-all'>
        {/* Top-level drop zone (top) */}
        <div
          ref={topDrop as any}
          className={cn(
            "h-2 -mt-1",
            isOverTop && "h-10 rounded-sm bg-primary/10 p-2 text-sm"
          )}
        />
        {layers.map((layer, index) => {
          return layer.type !== "document" ? (
            <DraggableLayerItem
              key={layer.id}
              id={layer.id}
              layer={layer}
              index={index}
              type='layer'
              isSelected={selectedLayerId === layer.id}
              onSelect={selectLayer}
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

        {/* Top-level drop zone (bottom) */}
        <div
          ref={bottomDrop as any}
          className={cn(
            "h-2",
            isOverBottom && "h-10 rounded-sm bg-primary/10 p-2 text-sm"
          )}
        />
      </div>

      <div className='flex items-center gap-1 border-t  p-2'>
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

        <AdjustmentLayersMenu
          handleAddAdjustmentLayer={handleAddAdjustmentLayer}
        />

        <FxLayersMenu handleAddAdjustmentLayer={handleAddAdjustmentLayer} />

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
          {layers.length - 1 === 1 ? "1 layer" : `${layers.length - 1} layers`}
        </div>
      </div>
    </div>
  )
}

export interface LayersPanelProps extends ComponentProps<"div"> {
  allowAddMultipleImages?: boolean
  toolsValues: ImageEditorToolsState
  dispatch: (value: ImageEditorToolsActions | ImageEditorToolsActions[]) => void
}
export function LayersPanel({
  toolsValues,
  dispatch,
  ...props
}: LayersPanelProps) {
  const { getSelectedLayerId, selectLayer } = useEditorContext()

  const isGlobalDragActive = useRef(false)
  const dropHandled = useRef(false)
  const selectedLayerId = getSelectedLayerId()

  const previousSelectedLayerId = useRef(selectedLayerId)

  return (
    <LayerContext.Provider value={{ isGlobalDragActive, dropHandled }}>
      <Tabs defaultValue='layers' className='w-full'>
        <TabsList className='w-full rounded-none'>
          <TabsTrigger
            value='layers'
            className='w-full'
            onClick={() => selectLayer(previousSelectedLayerId.current)}
          >
            Layers
          </TabsTrigger>
          <TabsTrigger
            value='document'
            className='w-full'
            onClick={() => {
              previousSelectedLayerId.current = selectedLayerId
              selectLayer("document")
            }}
          >
            Document
          </TabsTrigger>
        </TabsList>
        <TabsContent value='layers'>
          <LayersPanelInner {...props} />
        </TabsContent>
        <TabsContent value='document'>
          <DocumentPanel toolsValues={toolsValues} dispatch={dispatch} />
        </TabsContent>
      </Tabs>
    </LayerContext.Provider>
  )
}
