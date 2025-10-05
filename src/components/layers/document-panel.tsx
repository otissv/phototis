"use client"

import { useCallback, useState, useEffect } from "react"
import { Eye, EyeOff, Lock, MoreHorizontal, Copy, Trash2 } from "lucide-react"

import { Button } from "@/ui/button"
import { useEditorContext } from "@/lib/editor/context"
import type {
  ImageEditorToolsActions,
  ImageEditorToolsState,
} from "@/lib/tools/tools-state"
import { capitalize } from "@/lib/utils/capitalize"
import { BlendModesControls } from "./blend-modes-controls"
import { OpacityControls } from "./opacity-controls"
import { Input } from "@/ui/input"
import { LayerThumbnail } from "./layer-content"
import { cn } from "@/lib/utils"
import { FxLayersMenu } from "./Fx-layers-menu"
import { AdjustmentLayersMenu } from "./adjustment-layers-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { AdjustmentLayerEditor } from "./adjustment.layer"
import type { AdjustmentLayer } from "@/lib/editor/state"

export interface DocumentPanelProps {
  toolsValues: ImageEditorToolsState
  dispatch: (value: ImageEditorToolsActions | ImageEditorToolsActions[]) => void
}

export function DocumentPanel({ toolsValues, dispatch }: DocumentPanelProps) {
  const {
    toolValues,
    state,
    addGlobalLayer,
    removeGlobalLayer,
    updateGlobalLayer,
  } = useEditorContext()

  const [globalSelectedLayerId, setGlobalSelectedLayerId] = useState<
    string | null
  >(null)

  const globalLayers = state.canonical.document.globalLayers
  const isDragActive = state.ephemeral.interaction.isDragging

  const handleAddGlobalAdjustmentLayer = useCallback(
    (adjustmentType: string) => {
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
        vibrance: { vibrance: toolValues.vibrance.defaultValue as number },
        grayscale: { grayscale: toolValues.grayscale.defaultValue as number },
        invert: { invert: toolValues.invert.defaultValue as number },
        sepia: { sepia: toolValues.sepia.defaultValue as number },
        sharpen: {
          sharpenAmount: (toolValues as any).sharpenAmount?.defaultValue || 1,
          sharpenRadius: (toolValues as any).sharpenRadius?.defaultValue || 1,
          sharpenThreshold:
            (toolValues as any).sharpenThreshold?.defaultValue || 0,
        },
        noise: {
          noiseAmount: (toolValues as any).noiseAmount?.defaultValue || 0,
          noiseSize: (toolValues as any).noiseSize?.defaultValue || 1,
        },
        blur: {
          blur: (toolValues as any).blur?.defaultValue || 0,
          blurType: (toolValues as any).blurType?.defaultValue || 0,
          blurDirection: (toolValues as any).blurDirection?.defaultValue || 0,
          blurCenter: (toolValues as any).blurCenter?.defaultValue || 0.5,
        },
      }

      const layer = {
        id: `global-${adjustmentType}-${Date.now()}`,
        name: `Global ${capitalize(adjustmentType)}`,
        type: "adjustment" as const,
        adjustmentType: adjustmentType as any,
        parameters: defaultParams[adjustmentType] || {},
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal" as any,
      }

      addGlobalLayer(layer, "top")
    },
    [toolValues, addGlobalLayer]
  )

  const handleToggleGlobalLayerVisibility = useCallback(
    (layerId: string) => {
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer) {
        updateGlobalLayer(layerId, { visible: !layer.visible })
      }
    },
    [globalLayers, updateGlobalLayer]
  )

  const handleToggleGlobalLayerLock = useCallback(
    (layerId: string) => {
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer) {
        updateGlobalLayer(layerId, { locked: !layer.locked })
      }
    },
    [globalLayers, updateGlobalLayer]
  )

  const handleUpdateGlobalLayerOpacity = useCallback(
    (layerId: string, opacity: number) => {
      updateGlobalLayer(layerId, { opacity })
    },
    [updateGlobalLayer]
  )

  const handleUpdateGlobalLayerBlendMode = useCallback(
    (layerId: string, blendMode: string) => {
      updateGlobalLayer(layerId, { blendMode: blendMode as any })
    },
    [updateGlobalLayer]
  )

  const handleUpdateGlobalLayerName = useCallback(
    (layerId: string, name: string) => {
      updateGlobalLayer(layerId, { name })
    },
    [updateGlobalLayer]
  )

  const handleRemoveGlobalLayer = useCallback(
    (layerId: string) => {
      removeGlobalLayer(layerId)
    },
    [removeGlobalLayer]
  )

  const handleDuplicateGlobalLayer = useCallback(
    (layerId: string) => {
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer) {
        const duplicatedLayer = {
          ...layer,
          id: `global-${layer.type}-${Date.now()}`,
          name: `${layer.name} Copy`,
        }
        addGlobalLayer(duplicatedLayer, "top")
      }
    },
    [globalLayers, addGlobalLayer]
  )

  const handleUpdateGlobalLayerParameters = useCallback(
    (layerId: string, parameters: Record<string, any>) => {
      // Update the layer with new parameters
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer && layer.type === "adjustment") {
        const newParameters = { ...layer.parameters, ...parameters }
        updateGlobalLayer(layerId, { parameters: newParameters } as any)
      }
    },
    [globalLayers, updateGlobalLayer]
  )

  return (
    <div className='w-full space-y-4 p-2'>
      <div className='flex items-center justify-between gap-2'>
        <BlendModesControls
          isDragActive={isDragActive}
          isGlobalDragActive={true}
          isDocumentLayerSelected={true}
          handleBlendModeChange={handleUpdateGlobalLayerBlendMode}
          selectedLayerId={globalSelectedLayerId}
        />
        <OpacityControls
          isDragActive={isDragActive}
          isGlobalDragActive={true}
          isDocumentLayerSelected={true}
          selectedLayerId={globalSelectedLayerId}
          handleOpacityChange={handleUpdateGlobalLayerOpacity}
        />
      </div>

      <div className='space-y-2'>
        {globalLayers.length === 0 ? (
          <div className='text-xs text-muted-foreground text-center py-4'>
            No global layers added
          </div>
        ) : (
          <div className='space-y-1'>
            {globalLayers.map((layer) => (
              <GlobalLayerItem
                key={layer.id}
                layer={layer}
                isSelected={globalSelectedLayerId === layer.id}
                onSelect={setGlobalSelectedLayerId}
                onDelete={() => handleRemoveGlobalLayer(layer.id)}
                onDuplicate={() => handleDuplicateGlobalLayer(layer.id)}
                onToggleVisibility={() =>
                  handleToggleGlobalLayerVisibility(layer.id)
                }
                onToggleLock={() => handleToggleGlobalLayerLock(layer.id)}
                onNameChange={(name) =>
                  handleUpdateGlobalLayerName(layer.id, name)
                }
                onOpacityChange={(opacity) =>
                  handleUpdateGlobalLayerOpacity(layer.id, opacity)
                }
                onUpdateParameters={(parameters) =>
                  handleUpdateGlobalLayerParameters(layer.id, parameters)
                }
              />
            ))}
          </div>
        )}
      </div>
      <div className='flex items-center gap-1 pb-2 border-t'>
        <AdjustmentLayersMenu
          handleAddAdjustmentLayer={handleAddGlobalAdjustmentLayer}
        />
        <FxLayersMenu
          handleAddAdjustmentLayer={handleAddGlobalAdjustmentLayer}
        />
      </div>
    </div>
  )
}

interface GlobalLayerItemProps {
  layer: any // Global layer type
  isSelected: boolean
  onSelect: (layerId: string) => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onNameChange: (name: string) => void
  onOpacityChange: (opacity: number) => void
  onUpdateParameters?: (parameters: Record<string, any>) => void
}

function GlobalLayerItem({
  layer,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onNameChange,
  onOpacityChange,
  onUpdateParameters,
}: GlobalLayerItemProps) {
  const isDragActive = false // Global layers don't support drag and drop
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(layer.name)

  const handleNameSubmit = useCallback(() => {
    if (isDragActive) return
    onNameChange(editName)
    setIsEditing(false)
  }, [editName, onNameChange])

  const handleNameKeyDown = useCallback(
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

  useEffect(() => {
    setEditName(layer.name)
  }, [layer.name])

  return (
    <div
      className={cn("rounded-sm bg-background/50", !isSelected && "border")}
      onClick={() => onSelect(layer.id)}
      onKeyUp={(e) => {
        if (e.key === "Enter") {
          onSelect(layer.id)
        }
      }}
    >
      <div
        className={cn(
          "rounded-tl-sm rounded-tr-sm",
          isSelected && "bg-primary/10"
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center px-2 rounded-t-sm rounded-b-none",
            layer.type === "image" && "rounded-b-sm"
          )}
        >
          <div className='flex items-center w-full h-10'>
            <div className='w-full'>
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
                      "text-sm truncate flex justify-start items-center text-left gap-1 h-6 flex-1 px-1 rounded-sm cursor-grab",
                      "hover:bg-transparent"
                    )}
                    onDoubleClick={() => !isDragActive && setIsEditing(true)}
                    disabled={isDragActive}
                  >
                    <span className='text-xs whitespace-nowrap truncate w-44'>
                      {layer.name}
                    </span>
                  </Button>
                </div>
              )}
            </div>

            <div className='flex items-center justify-center p-0.5'>
              <Button
                title='Toggle layer visibility'
                className='w-9 h-9 p-0 rounded-sm cursor-pointer'
                size='sm'
                variant='ghost'
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
                className='w-9 h-9 p-0 rounded-sm cursor-pointer'
                size='sm'
                variant='ghost'
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onToggleLock()
                }}
                disabled={isDragActive}
              >
                <Lock
                  className={cn(
                    "w-3 h-3",
                    layer.locked ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  title='More options'
                  className='w-9 h-9 rounded-sm cursor-pointer'
                  size='sm'
                  variant='ghost'
                >
                  <MoreHorizontal className='size-3' />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className='flex flex-col'>
                <DropdownMenuItem
                  onSelect={() => onDuplicate()}
                  className='gap-2 justify-start rounded-sm cursor-pointer text-sm'
                  disabled={isDragActive}
                  title='Duplicate layer'
                >
                  <Copy className={cn("size-4")} /> Duplicate
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => onDelete()}
                  className='gap-2 justify-start text-destructive rounded-sm cursor-pointer text-sm'
                  disabled={isDragActive}
                  title='Delete layer'
                >
                  <Trash2 className={cn("size-4")} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {layer.type === "adjustment" && isSelected && onUpdateParameters && (
        <div>
          <AdjustmentLayerEditor
            layer={layer as AdjustmentLayer}
            onUpdate={(params) => {
              onUpdateParameters?.(params)
            }}
          />
        </div>
      )}
    </div>
  )
}
