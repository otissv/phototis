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
  Camera,
} from "lucide-react"
import { useDrag, useDrop } from "react-dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { BLEND_MODE_NAMES, type BlendMode } from "@/lib/shaders/blend-modes"
import { useEditorContext } from "@/lib/editor/context"
import type { EditorLayer } from "@/lib/editor/state"

export interface LayerSystemProps extends React.ComponentProps<"div"> {}

// Drag item type for react-dnd
const ItemTypes = {
  LAYER: "layer",
}

interface DragItem {
  id: string
  index: number
  type: string
}

// Global drag state to prevent updates during drag
let isGlobalDragActive = false

export function LayerSystem({ className, ...rest }: LayerSystemProps) {
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
    state,
    setEphemeral,
  } = useEditorContext()

  const layers = getOrderedLayers()
  const selectedLayerId = getSelectedLayerId()
  const isDragActive = state.ephemeral.interaction.isDragging

  const handleAddLayer = React.useCallback(() => {
    if (isDragActive) return
    addEmptyLayer()
  }, [addEmptyLayer, isDragActive])

  const handleFileUpload = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isDragActive || isGlobalDragActive) return

      const files = event.target.files
      if (!files || files.length === 0) return

      const file = files[0]
      if (!file.type.startsWith("image/")) {
        console.warn("Selected file is not an image")
        return
      }

      // Create a new layer with the uploaded image
      addImageLayer(file)

      // Reset the input value to allow selecting the same file again
      event.target.value = ""
    },
    [addImageLayer, isDragActive]
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
      setOpacity(layerId, opacity)
    },
    [setOpacity, isDragActive]
  )

  const handleMoveLayer = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderLayers(fromIndex, toIndex)
    },
    [reorderLayers]
  )

  const currentLayer = React.useMemo(() => {
    return layers.find((layer) => layer.id === selectedLayerId)
  }, [layers, selectedLayerId])

  return (
    <div className={cn("w-full space-y-2", className)}>
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
                disabled={isDragActive || isGlobalDragActive}
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
              value={currentLayer?.opacity || 100}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleOpacityChange(
                  selectedLayerId as string,
                  Number(e.target.value)
                )
              }
              className=' px-2 py-1 h-8 border-none'
              disabled={isDragActive || isGlobalDragActive}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='size-8 p-0 rounded-sm'
                  disabled={isDragActive || isGlobalDragActive}
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
                    disabled={isDragActive || isGlobalDragActive}
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
        {layers.map((layer, index) => (
          <DraggableLayerItem
            key={layer.id}
            layer={layer}
            index={index}
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
          />
        ))}
      </div>

      <div className='flex items-center gap-1 border-t border-border p-2'>
        {/* File upload button */}
        <div className='relative h-8 w-8 p-0 flex items-center justify-center rounded-sm hover:bg-muted'>
          <Camera className='w-4 h-4' />
          <input
            type='file'
            accept='image/*'
            onChange={handleFileUpload}
            className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
            disabled={isDragActive || isGlobalDragActive}
            title='Upload image to new layer'
          />
        </div>

        <div className='text-xs ml-auto text-muted-foreground'>{layers.length === 1 ? "1 layer" : `${layers.length} layers`}</div>

        {/* Empty layer button */}
        {/* <Button
          variant='ghost'
          size='sm'
          onClick={handleAddLayer}
          className='h-8 w-8 p-0'
          disabled={isDragActive || isGlobalDragActive}
          title='Add empty layer'
        >
          <Layers className='w-4 h-4' />
        </Button> */}
      </div>
    </div>
  )
}

interface DraggableLayerItemProps {
  layer: EditorLayer
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
  const { setEphemeral } = useEditorContext()
  const [{ isDragging }, drag] = useDrag<
    DragItem,
    void,
    { isDragging: boolean }
  >({
    type: ItemTypes.LAYER,
    item: { id: layer.id, index, type: ItemTypes.LAYER },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  // Track drag state changes
  React.useEffect(() => {
    if (isDragging) {
      isGlobalDragActive = true
    } else {
      isGlobalDragActive = false
    }
    setEphemeral((e) => {
      const nextDragging = isDragging
      const nextId = isDragging ? layer.id : undefined
      if (
        e.interaction.isDragging === nextDragging &&
        e.interaction.dragLayerId === nextId
      ) {
        return e
      }
      return {
        ...e,
        interaction: {
          ...e.interaction,
          isDragging: nextDragging,
          dragLayerId: nextId,
        },
      }
    })
  }, [isDragging, layer.id, setEphemeral])

  const { history } = useEditorContext()
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.LAYER,
    hover: (item: DragItem, monitor) => {
      try {
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

        // transaction handled by drag state effect
        // Time to actually perform the action
        onMoveLayer(dragIndex, hoverIndex)

        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        item.index = hoverIndex
      } catch (error) {
        // Silently handle React DnD errors during drag operations
        console.warn("React DnD hover error:", error)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    canDrop: () => {
      // Allow drops during layer drag operations
      // The isGlobalDragActive flag is used to prevent other UI interactions during drag
      // but we want to allow layer reordering during drag
      return true
    },
  })

  const ref = React.useRef<HTMLDivElement>(null)
  drag(drop(ref))

  // Manage transaction lifecycle for drag start/end
  const dragTxnStartedRef = React.useRef(false)
  React.useEffect(() => {
    if (isDragging && !dragTxnStartedRef.current) {
      dragTxnStartedRef.current = true
      history.begin("Reorder Layers")
    }
    if (!isDragging && dragTxnStartedRef.current) {
      dragTxnStartedRef.current = false
      history.end(true)
    }
  }, [isDragging, history])

  React.useEffect(() => {
    if (!isDragging) {
      history.end(true)
    }
  }, [isDragging, history])

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
        isDragActive={isDragging || isGlobalDragActive}
      />
    </div>
  )
}

interface LayerItemProps {
  layer: EditorLayer
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
  isDragActive?: boolean
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
  isDragActive = false,
}: LayerItemProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editName, setEditName] = React.useState(layer.name)

  const handleNameSubmit = React.useCallback(() => {
    if (isDragActive) return
    onNameChange(editName)
    setIsEditing(false)
  }, [editName, onNameChange, isDragActive])

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
            disabled={isDragActive}
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
            disabled={isDragActive}
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
                disabled={isDragActive}
              />
            ) : (
              <div className='flex items-center gap-2'>
                <LayerThumbnail layer={layer} />
                <Button
                  variant='ghost'
                  className={cn(
                    "text-sm truncate flex items-center gap-1 h-6 flex-1 justify-start px-1 rounded-sm cursor-grab",
                    "hover:bg-transparent"
                  )}
                  onDoubleClick={() => !isDragActive && setIsEditing(true)}
                  disabled={isDragActive}
                >
                  <span className='text-xs whitespace-nowrap truncate'>
                    {layer.name}
                  </span>
                </Button>
              </div>
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
              disabled={isDragActive}
              title='Duplicate layer'
            >
              <Copy className={cn("w-3 h-3")} />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onDelete()
              }}
              className='size-10 p-0 text-destructive rounded-sm cursor-pointer'
              disabled={isDragActive}
              title='Delete layer'
            >
              <Trash2 className={cn("w-3 h-3")} />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// Thumbnail component for layer preview
function LayerThumbnail({ layer }: { layer: EditorLayer }) {
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    const file = layer.image
    // Only accept Blob/File instances
    if (file && typeof window !== "undefined" && file instanceof Blob) {
      const url = URL.createObjectURL(file)
      setThumbnailUrl(url)

      return () => {
        try {
          URL.revokeObjectURL(url)
        } catch {}
        setThumbnailUrl(null)
      }
    }
    // Clean up if no image
    setThumbnailUrl(null)
  }, [layer.image])

  if (!thumbnailUrl) {
    return <div className='size-6' />
  }

  return (
    <div className='w-6 h-6 rounded-xs overflow-hidden border border-border'>
      <img
        src={thumbnailUrl}
        alt={layer.name}
        className='w-full h-full object-cover'
      />
    </div>
  )
}
