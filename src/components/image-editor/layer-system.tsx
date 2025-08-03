"use client"

import React from "react"
import { Plus, Trash2, Eye, EyeOff, Copy, Layers, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ImageEditorToolsState } from "./state.image-editor"
import { initialState } from "./state.image-editor"

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  filters: ImageEditorToolsState
  opacity: number
  isEmpty: boolean // New property to track if layer is empty/transparent
}

export interface LayerSystemProps {
  layers: Layer[]
  selectedLayerId: string | null
  onLayersChange: (layers: Layer[]) => void
  onSelectedLayerChange: (layerId: string | null) => void
  onLayerFiltersChange: (
    layerId: string,
    filters: ImageEditorToolsState
  ) => void
}

export function LayerSystem({
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

  return (
    <div className='bg-background  p-4 w-fit'>
      <div className='flex items-center justify-between mb-4'>
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

      <div className='space-y-2'>
        {layers.map((layer, index) => (
          <LayerItem
            key={layer.id}
            layer={layer}
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
            onMoveUp={
              index > 0 ? () => handleMoveLayer(index, index - 1) : undefined
            }
            onMoveDown={
              index < layers.length - 1
                ? () => handleMoveLayer(index, index + 1)
                : undefined
            }
          />
        ))}
      </div>
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

function LayerItem({
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
    <div
      className={cn(
        "p-2 cursor-pointer transition-colors w-full text-left rounded-sm",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50"
      )}
      onClick={onSelect}
      aria-label={`Select layer ${layer.name}`}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          onSelect()
        }
      }}
    >
      <div className='flex items-center gap-2 mb-2'>
        <Button
          title='Toggle layer visibility'
          variant='ghost'
          size='sm'
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onToggleVisibility()
          }}
          className='h-6 w-6 p-0 rounded-sm'
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
          className='h-6 w-6 p-0 rounded-sm'
        >
          <Lock
            className={cn(
              "w-3 h-3",
              layer.locked ? "text-primary" : "text-muted-foreground"
            )}
          />
        </Button>

        <div className='flex-1 min-w-0'>
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEditName(e.target.value)
              }
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              className={cn(
                "h-6 text-sm rounded-sm outline-none",
                "focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0"
              )}
              autoFocus
            />
          ) : (
            <Button
              variant='ghost'
              className={cn(
                "text-sm truncate flex items-center gap-1 h-6 flex-1 w-full justify-start cursor-pointer rounded-sm",
                "hover:bg-transparent"
              )}
              onDoubleClick={() => setIsEditing(true)}
            >
              <span>{layer.name}</span>
              {layer.isEmpty && (
                <span className='text-xs text-muted-foreground'>(empty)</span>
              )}
            </Button>
          )}
        </div>

        <div className='flex gap-1'>
          {onMoveUp && (
            <Button
              variant='ghost'
              size='sm'
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onMoveUp()
              }}
              className='h-6 w-6 p-0 rounded-sm'
            >
              ↑
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant='ghost'
              size='sm'
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onMoveDown()
              }}
              className='h-6 w-6 p-0 rounded-sm'
            >
              ↓
            </Button>
          )}
          <Button
            variant='ghost'
            size='sm'
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className='h-6 w-6 p-0 rounded-sm'
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
            className='h-6 w-6 p-0 text-destructive rounded-sm'
          >
            <Trash2 className='w-3 h-3' />
          </Button>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <span className='text-xs text-muted-foreground'>Opacity:</span>
        <input
          type='range'
          min='0'
          max='100'
          value={layer.opacity}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onOpacityChange(Number(e.target.value))
          }
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
          onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
          className='flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer'
        />
        <span className='text-xs w-8'>{layer.opacity}%</span>
      </div>
    </div>
  )
}
