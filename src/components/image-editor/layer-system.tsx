"use client"

import React from "react"
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Layers,
  Lock,
  ChevronDown,
} from "lucide-react"
import { useDrag, useDrop } from "react-dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ImageEditorToolsState } from "./state.image-editor"
import { initialState } from "./state.image-editor"
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu"
import { DropdownMenu } from "../ui/dropdown-menu"

export interface Layer extends React.ComponentProps<"div"> {
  id: string
  name: string
  visible: boolean
  locked: boolean
  filters: ImageEditorToolsState
  opacity: number
  isEmpty: boolean // New property to track if layer is empty/transparent
  image?: File | null // Optional image data for the layer
}

export interface LayerSystemProps extends React.ComponentProps<"div"> {
  layers: Layer[]
  selectedLayerId: string | null
  onLayersChange: (layers: Layer[]) => void
  onSelectedLayerChange: (layerId: string | null) => void
  onLayerFiltersChange: (
    layerId: string,
    filters: ImageEditorToolsState
  ) => void
}

// Drag item type for react-dnd
const ItemTypes = {
  LAYER: "layer",
}

interface DragItem {
  id: string
  index: number
  type: string
}

export function LayerSystem({
  className,
  layers,
  selectedLayerId,
  onLayersChange,
  onSelectedLayerChange,
  onLayerFiltersChange,
}: LayerSystemProps) {
  const handleAddLayer = React.useCallback(() => {
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      filters: { ...initialState },
      opacity: 100,
      isEmpty: true, // New layers are empty/transparent
    }
    onLayersChange([...layers, newLayer])
    onSelectedLayerChange(newLayer.id)
  }, [layers, onLayersChange, onSelectedLayerChange])

  const handleDeleteLayer = React.useCallback(
    (layerId: string) => {
      const newLayers = layers.filter((layer) => layer.id !== layerId)
      onLayersChange(newLayers)

      if (selectedLayerId === layerId) {
        onSelectedLayerChange(newLayers.length > 0 ? newLayers[0].id : null)
      }
    },
    [layers, selectedLayerId, onLayersChange, onSelectedLayerChange]
  )

  const handleDuplicateLayer = React.useCallback(
    (layerId: string) => {
      const layerToDuplicate = layers.find((layer) => layer.id === layerId)
      if (!layerToDuplicate) return

      const duplicatedLayer: Layer = {
        ...layerToDuplicate,
        id: `layer-${Date.now()}`,
        name: `${layerToDuplicate.name} (Copy)`,
        isEmpty: layerToDuplicate.isEmpty, // Preserve the empty state
      }
      onLayersChange([...layers, duplicatedLayer])
      onSelectedLayerChange(duplicatedLayer.id)
    },
    [layers, onLayersChange, onSelectedLayerChange]
  )

  const handleToggleVisibility = React.useCallback(
    (layerId: string) => {
      const newLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
      onLayersChange(newLayers)
    },
    [layers, onLayersChange]
  )

  const handleToggleLock = React.useCallback(
    (layerId: string) => {
      const newLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
      )
      onLayersChange(newLayers)
    },
    [layers, onLayersChange]
  )

  const handleLayerNameChange = React.useCallback(
    (layerId: string, name: string) => {
      const newLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, name } : layer
      )
      onLayersChange(newLayers)
    },
    [layers, onLayersChange]
  )

  const handleOpacityChange = React.useCallback(
    (layerId: string, opacity: number) => {
      const newLayers = layers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
      onLayersChange(newLayers)
    },
    [layers, onLayersChange]
  )

  const handleMoveLayer = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const newLayers = [...layers]
      const [movedLayer] = newLayers.splice(fromIndex, 1)
      newLayers.splice(toIndex, 0, movedLayer)
      onLayersChange(newLayers)
    },
    [layers, onLayersChange]
  )

  const currentLayer = React.useMemo(() => {
    return layers.find((layer) => layer.id === selectedLayerId)
  }, [layers, selectedLayerId])

  return (
    <div className={cn("w-[320px]", className)}>
      <div className='border p-1 rounded-sm'>
        <div className='flex items-center justify-between h-10 px-2'>
          <h3 className='text-sm font-medium flex items-center gap-2'>
            <Layers className='w-4 h-4' />
            Layers
          </h3>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleAddLayer}
            className='h-8 w-8 p-0'
          >
            <Plus className='w-4 h-4' />
          </Button>
        </div>

        <div className='flex items-center justify-between gap-2 h-12 p-2 text-xs'>
          <div>Blending mode</div>
          <div className='flex items-center gap-1'>
            <span className='text-xs text-muted-foreground'>Opacity:</span>
            <div className='flex items-center border rounded-sm h-9'>
              <Input
                type='number'
                min='0'
                max='100'
                value={currentLayer?.opacity || 100}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleOpacityChange(
                    selectedLayerId as string,
                    Number(e.target.value)
                  )
                }
                className=' px-2 py-1 h-8 border-none'
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='size-8 p-0 rounded-sm'
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
                      onKeyDown={(e: React.KeyboardEvent) =>
                        e.stopPropagation()
                      }
                      onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
                      className='h-1 bg-secondary rounded-lg appearance-none cursor-pointer'
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

        <div className='space-y-2 transition-all'>
          {layers.map((layer, index) => (
            <DraggableLayerItem
              key={layer.id}
              layer={layer}
              index={index}
              isSelected={selectedLayerId === layer.id}
              onSelect={() => onSelectedLayerChange(layer.id)}
              onDelete={() => handleDeleteLayer(layer.id)}
              onDuplicate={() => handleDuplicateLayer(layer.id)}
              onToggleVisibility={() => handleToggleVisibility(layer.id)}
              onToggleLock={() => handleToggleLock(layer.id)}
              onNameChange={(name) => handleLayerNameChange(layer.id, name)}
              onOpacityChange={(opacity) =>
                handleOpacityChange(layer.id, opacity)
              }
              onMoveLayer={handleMoveLayer}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface DraggableLayerItemProps {
  layer: Layer
  index: number
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onNameChange: (name: string) => void
  onOpacityChange: (opacity: number) => void
  onMoveLayer: (fromIndex: number, toIndex: number) => void
}

function DraggableLayerItem({
  layer,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onNameChange,
  onOpacityChange,
  onMoveLayer,
}: DraggableLayerItemProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.LAYER,
    item: { id: layer.id, index, type: ItemTypes.LAYER },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.LAYER,
    hover: (item: DragItem, monitor) => {
      if (!item || item.id === layer.id) {
        return
      }

      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect()
      if (!hoverBoundingRect) {
        return
      }

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()
      if (!clientOffset) {
        return
      }

      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50% of the item height
      // When dragging upwards, only move when the cursor is above 50% of the item height

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      // Time to actually perform the action
      onMoveLayer(dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  })

  const ref = React.useRef<HTMLDivElement>(null)
  drag(drop(ref))

  return (
    <div
      ref={ref}
      className={cn(
        "cursor-pointer transition-colors w-full text-left rounded-sm space-y-1",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50",
        isDragging && "opacity-50",
        isOver && "border-primary/30"
      )}
      onClick={onSelect}
      aria-label={`Select layer ${layer.name}`}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          onSelect()
        }
      }}
    >
      <LayerItemContent
        layer={layer}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
        onNameChange={onNameChange}
        onOpacityChange={onOpacityChange}
      />
    </div>
  )
}

interface LayerItemProps {
  layer: Layer
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onNameChange: (name: string) => void
  onOpacityChange: (opacity: number) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function LayerItemContent({
  layer,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onNameChange,
  onOpacityChange,
  onMoveUp,
  onMoveDown,
}: LayerItemProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editName, setEditName] = React.useState(layer.name)

  const handleNameSubmit = React.useCallback(() => {
    onNameChange(editName)
    setIsEditing(false)
  }, [editName, onNameChange])

  const handleNameKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleNameSubmit()
      } else if (e.key === "Escape") {
        setEditName(layer.name)
        setIsEditing(false)
      }
    },
    [handleNameSubmit, layer.name]
  )

  React.useEffect(() => {
    setEditName(layer.name)
  }, [layer.name])

  return (
    <>
      <div className='flex flex-col items-center justify-between'>
        <div className='flex items-center'>
          <Button
            title='Toggle layer visibility'
            variant='ghost'
            size='sm'
            className='w-10 p-0 rounded-l-sm cursor-pointer'
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onToggleVisibility()
            }}
          >
            {layer.visible ? (
              <Eye className='w-3 h-3' />
            ) : (
              <EyeOff className='w-3 h-3' />
            )}
          </Button>

          <Button
            title='Toggle layer lock'
            variant='ghost'
            size='sm'
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onToggleLock()
            }}
            className='size-10 p-0 rounded-sm cursor-pointer'
          >
            <Lock
              className={cn(
                "w-3 h-3",
                layer.locked ? "text-primary" : "text-muted-foreground"
              )}
            />
          </Button>

          <div className='flex-1 w-32'>
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditName(e.target.value)
                }
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                className={cn(
                  "h-6 text-sm rounded-sm outline-none px-1",
                  "focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0"
                )}
                autoFocus
              />
            ) : (
              <Button
                variant='ghost'
                className={cn(
                  "text-sm truncate flex items-center gap-1 h-6 flex-1 w-full justify-start px-1cursor-pointer rounded-sm cursor-grab",
                  "hover:bg-transparent"
                )}
                onDoubleClick={() => setIsEditing(true)}
              >
                <span className='text-xs whitespace-nowrap truncate'>
                  {layer.name}
                </span>
                {layer.isEmpty && (
                  <span className='text-xs text-muted-foreground'>(empty)</span>
                )}
              </Button>
            )}
          </div>

          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onDuplicate()
              }}
              className='size-10 p-0 rounded-sm cursor-pointer'
            >
              <Copy className='w-3 h-3' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onDelete()
              }}
              className='size-10 p-0 text-destructive rounded-sm cursor-pointer'
            >
              <Trash2 className='w-3 h-3' />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
