"use client"

import React from "react"
import {
  ChevronDown,
  Droplets,
  Eclipse,
  Image,
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
import { BLEND_MODE_NAMES } from "@/lib/shaders/blend-modes/blend-modes"
import type { BlendMode } from "@/lib/shaders/blend-modes/types.blend"
import { useEditorContext } from "@/lib/editor/context"
import { TOOL_VALUES } from "@/lib/tools/tools"

import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"

import { DocumentLayerItem } from "./document-layer"
import {
  DraggableLayerItem,
  type DragItem,
} from "@/components/layers/draggable-layer"
import { useDrop } from "react-dnd"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { Slider } from "@/ui/slider"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import {
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Settings,
  Palette,
} from "lucide-react"
import { FxIcon } from "@/ui/icons/fx-icon"

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

export function useCurrentLayer({
  selectedLayerId,
  isDocumentLayerSelected,
}: { selectedLayerId: string | null; isDocumentLayerSelected: boolean }) {
  const { getOrderedLayers, getSelectedLayerId, getGlobalLayers } =
    useEditorContext()
  const layers = getOrderedLayers()

  if (isDocumentLayerSelected) {
    const globalLayers = getGlobalLayers()
    return globalLayers.find((layer) => layer.id === selectedLayerId)
  }

  return React.useMemo(() => {
    // First, try to find the layer in the main layers array
    let layer = layers.find((layer) => layer.id === selectedLayerId)

    // If not found, search within group children
    if (!layer) {
      for (const mainLayer of layers) {
        if (mainLayer.type === "group") {
          const groupLayer = mainLayer as any
          if (groupLayer.children && Array.isArray(groupLayer.children)) {
            const childLayer = groupLayer.children.find(
              (child: any) => child.id === selectedLayerId
            )
            if (childLayer) {
              layer = childLayer
              break
            }
          }
        }
      }
    }

    return layer
  }, [layers, selectedLayerId])
}

function useBlendModeChange({ isDragActive }: { isDragActive: boolean }) {
  const { getOrderedLayers, updateLayer, setBlendMode } = useEditorContext()

  return React.useCallback(
    (layerId: string, blendMode: BlendMode) => {
      if (isDragActive) return

      // Get fresh layers data to avoid stale closure issues
      const currentLayers = getOrderedLayers()

      // Check if this is a group child by searching within groups
      let isGroupChild = false
      let parentGroupId: string | null = null

      for (const mainLayer of currentLayers) {
        if (mainLayer.type === "group") {
          const groupLayer = mainLayer as any
          if (groupLayer.children && Array.isArray(groupLayer.children)) {
            const childLayer = groupLayer.children.find(
              (child: any) => child.id === layerId
            )
            if (childLayer) {
              isGroupChild = true
              parentGroupId = mainLayer.id
              break
            }
          }
        }
      }

      if (isGroupChild && parentGroupId) {
        // Update the child within the group
        const parentGroup = currentLayers.find(
          (l) => l.id === parentGroupId
        ) as any
        if (parentGroup?.children) {
          const updatedChildren = parentGroup.children.map((child: any) =>
            child.id === layerId ? { ...child, blendMode } : child
          )
          updateLayer(parentGroupId, { children: updatedChildren } as any)
        }
      } else {
        // Update the layer normally
        setBlendMode(layerId, blendMode)
      }
    },
    [setBlendMode, isDragActive, getOrderedLayers, updateLayer]
  )
}

function useOpacityChange({ isDragActive }: { isDragActive: boolean }) {
  const { getOrderedLayers, updateLayer, setOpacity } = useEditorContext()

  return React.useCallback(
    (layerId: string, opacity: number) => {
      if (isDragActive) return
      let value = opacity
      if (opacity < 0) {
        value = 0
      } else if (opacity > 100) {
        value = 100
      }

      // Get fresh layers data to avoid stale closure issues
      const currentLayers = getOrderedLayers()

      // Check if this is a group child by searching within groups
      let isGroupChild = false
      let parentGroupId: string | null = null

      for (const mainLayer of currentLayers) {
        if (mainLayer.type === "group") {
          const groupLayer = mainLayer as any
          if (groupLayer.children && Array.isArray(groupLayer.children)) {
            const childLayer = groupLayer.children.find(
              (child: any) => child.id === layerId
            )
            if (childLayer) {
              isGroupChild = true
              parentGroupId = mainLayer.id
              break
            }
          }
        }
      }

      if (isGroupChild && parentGroupId) {
        // Update the child within the group
        const parentGroup = currentLayers.find(
          (l) => l.id === parentGroupId
        ) as any
        if (parentGroup?.children) {
          const updatedChildren = parentGroup.children.map((child: any) =>
            child.id === layerId ? { ...child, opacity: value } : child
          )
          updateLayer(parentGroupId, { children: updatedChildren } as any)
        }
      } else {
        // Update the layer normally
        setOpacity(layerId, value)
      }
    },
    [setOpacity, isDragActive, getOrderedLayers, updateLayer]
  )
}

export interface LayersPanelProps extends React.ComponentProps<"div"> {
  setSelectedSidebar: (sidebar: keyof typeof SIDEBAR_TOOLS) => void
  allowAddMultipleImages?: boolean
}

function DocumentPanel() {
  const { isGlobalDragActive } = React.useContext(LayerContext)

  const {
    addGlobalLayer,
    removeGlobalLayer,
    updateGlobalLayer,
    reorderGlobalLayer,
    setGlobalParameters,
    updateGlobalParameter,
    removeGlobalParameter,
    getSelectedLayerId,
    getOrderedLayers,
    state,
  } = useEditorContext()

  const [globalSelectedLayerId, setGlobalSelectedLayerId] = React.useState<
    string | null
  >(null)

  const globalLayers = state.canonical.document.globalLayers
  const isDragActive = state.ephemeral.interaction.isDragging

  const [expandedLayers, setExpandedLayers] = React.useState<Set<string>>(
    new Set()
  )
  const [editingLayerName, setEditingLayerName] = React.useState<string | null>(
    null
  )
  const [tempLayerName, setTempLayerName] = React.useState("")

  const handleAddGlobalAdjustmentLayer = React.useCallback(
    (adjustmentType: string) => {
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
        vibrance: { vibrance: TOOL_VALUES.vibrance.defaultValue as number },
        grayscale: { grayscale: TOOL_VALUES.grayscale.defaultValue as number },
        invert: { invert: TOOL_VALUES.invert.defaultValue as number },
        sepia: { sepia: TOOL_VALUES.sepia.defaultValue as number },
        sharpen: {
          sharpenAmount: (TOOL_VALUES as any).sharpenAmount?.defaultValue || 1,
          sharpenRadius: (TOOL_VALUES as any).sharpenRadius?.defaultValue || 1,
          sharpenThreshold:
            (TOOL_VALUES as any).sharpenThreshold?.defaultValue || 0,
        },
        noise: {
          noiseAmount: (TOOL_VALUES as any).noiseAmount?.defaultValue || 0,
          noiseSize: (TOOL_VALUES as any).noiseSize?.defaultValue || 1,
        },
        blur: {
          blur: (TOOL_VALUES as any).blur?.defaultValue || 0,
          blurType: (TOOL_VALUES as any).blurType?.defaultValue || 0,
          blurDirection: (TOOL_VALUES as any).blurDirection?.defaultValue || 0,
          blurCenter: (TOOL_VALUES as any).blurCenter?.defaultValue || 0.5,
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
    [addGlobalLayer]
  )

  const handleAddGlobalMaskLayer = React.useCallback(() => {
    const layer = {
      id: `global-mask-${Date.now()}`,
      name: "Global Mask",
      type: "mask" as const,
      enabled: true,
      inverted: false,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal" as any,
    }

    addGlobalLayer(layer, "top")
  }, [addGlobalLayer])

  const handleToggleGlobalLayerVisibility = React.useCallback(
    (layerId: string) => {
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer) {
        updateGlobalLayer(layerId, { visible: !layer.visible })
      }
    },
    [globalLayers, updateGlobalLayer]
  )

  const handleToggleGlobalLayerLock = React.useCallback(
    (layerId: string) => {
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer) {
        updateGlobalLayer(layerId, { locked: !layer.locked })
      }
    },
    [globalLayers, updateGlobalLayer]
  )

  const handleUpdateGlobalLayerOpacity = React.useCallback(
    (layerId: string, opacity: number) => {
      updateGlobalLayer(layerId, { opacity })
    },
    [updateGlobalLayer]
  )

  const handleUpdateGlobalLayerBlendMode = React.useCallback(
    (layerId: string, blendMode: string) => {
      updateGlobalLayer(layerId, { blendMode: blendMode as any })
    },
    [updateGlobalLayer]
  )

  const handleUpdateGlobalLayerName = React.useCallback(
    (layerId: string, name: string) => {
      updateGlobalLayer(layerId, { name })
      setEditingLayerName(null)
    },
    [updateGlobalLayer]
  )

  const handleUpdateGlobalLayerParameter = React.useCallback(
    (layerId: string, paramKey: string, value: number) => {
      const layer = globalLayers.find((l) => l.id === layerId)
      if (layer && layer.type === "adjustment") {
        const newParameters = { ...layer.parameters, [paramKey]: value }
        updateGlobalLayer(layerId, { parameters: newParameters })
      }
    },
    [globalLayers, updateGlobalLayer]
  )

  const handleUpdateSolidLayerColor = React.useCallback(
    (layerId: string, color: [number, number, number, number]) => {
      updateGlobalLayer(layerId, { color })
    },
    [updateGlobalLayer]
  )

  const handleUpdateMaskLayerEnabled = React.useCallback(
    (layerId: string, enabled: boolean) => {
      updateGlobalLayer(layerId, { enabled })
    },
    [updateGlobalLayer]
  )

  const handleUpdateMaskLayerInverted = React.useCallback(
    (layerId: string, inverted: boolean) => {
      updateGlobalLayer(layerId, { inverted })
    },
    [updateGlobalLayer]
  )

  const handleRemoveGlobalLayer = React.useCallback(
    (layerId: string) => {
      removeGlobalLayer(layerId)
    },
    [removeGlobalLayer]
  )

  const handleToggleLayerExpanded = React.useCallback((layerId: string) => {
    setExpandedLayers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(layerId)) {
        newSet.delete(layerId)
      } else {
        newSet.add(layerId)
      }
      return newSet
    })
  }, [])

  const handleStartEditingName = React.useCallback(
    (layerId: string, currentName: string) => {
      setEditingLayerName(layerId)
      setTempLayerName(currentName)
    },
    []
  )

  const handleCancelEditingName = React.useCallback(() => {
    setEditingLayerName(null)
    setTempLayerName("")
  }, [])

  const handleConfirmEditingName = React.useCallback(
    (layerId: string) => {
      if (tempLayerName.trim()) {
        handleUpdateGlobalLayerName(layerId, tempLayerName.trim())
      } else {
        handleCancelEditingName()
      }
    },
    [tempLayerName, handleUpdateGlobalLayerName, handleCancelEditingName]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent, layerId: string) => {
      if (e.key === "Enter") {
        handleConfirmEditingName(layerId)
      } else if (e.key === "Escape") {
        handleCancelEditingName()
      }
    },
    [handleConfirmEditingName, handleCancelEditingName]
  )

  // const handleBlendModeChange = useBlendModeChange({ isDragActive })
  const handleOpacityChange = useOpacityChange({ isDragActive })

  return (
    <div className='w-full space-y-4 p-2'>
      <BlendModesControls
        isDragActive={isDragActive}
        isGlobalDragActive={isGlobalDragActive}
        isDocumentLayerSelected={true}
        handleBlendModeChange={handleUpdateGlobalLayerBlendMode}
        selectedLayerId={globalSelectedLayerId}
      />
      <OpacityControls
        isDragActive={isDragActive}
        isGlobalDragActive={isGlobalDragActive}
        isDocumentLayerSelected={true}
        selectedLayerId={globalSelectedLayerId}
        handleOpacityChange={handleUpdateGlobalLayerOpacity}
      />

      <div className='space-y-3'>
        {globalLayers.length === 0 ? (
          <div className='text-xs text-muted-foreground text-center py-4'>
            No global layers added
          </div>
        ) : (
          <div className='space-y-1'>
            {globalLayers.map((layer, index) => {
              const isExpanded = expandedLayers.has(layer.id)
              const isEditingName = editingLayerName === layer.id

              return (
                <div
                  key={layer.id}
                  className={cn(
                    "border  rounded-sm bg-background/50",
                    globalSelectedLayerId === layer.id &&
                      "border-primary bg-primary/10"
                  )}
                  onClick={() => setGlobalSelectedLayerId(layer.id)}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") {
                      setGlobalSelectedLayerId(layer.id)
                    }
                  }}
                >
                  {/* Layer Header */}
                  <div className='flex items-center gap-2 p-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-4 w-4 p-0'
                      onClick={() =>
                        handleToggleGlobalLayerVisibility(layer.id)
                      }
                      title={layer.visible ? "Hide Layer" : "Show Layer"}
                    >
                      {layer.visible ? (
                        <Eye className='w-3 h-3' />
                      ) : (
                        <EyeOff className='w-3 h-3' />
                      )}
                    </Button>

                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-4 w-4 p-0'
                      onClick={() => handleToggleGlobalLayerLock(layer.id)}
                      title={layer.locked ? "Unlock Layer" : "Lock Layer"}
                    >
                      {layer.locked ? (
                        <Lock className='w-3 h-3' />
                      ) : (
                        <Unlock className='w-3 h-3' />
                      )}
                    </Button>

                    <div className='flex-1 min-w-0'>
                      {isEditingName ? (
                        <Input
                          value={tempLayerName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setTempLayerName(e.target.value)
                          }
                          onKeyDown={(
                            e: React.KeyboardEvent<HTMLInputElement>
                          ) => handleKeyDown(e, layer.id)}
                          onBlur={() => handleConfirmEditingName(layer.id)}
                          className='h-6 text-xs'
                          autoFocus
                        />
                      ) : (
                        <button
                          className='flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 w-full text-left'
                          onDoubleClick={() =>
                            handleStartEditingName(layer.id, layer.name)
                          }
                          type='button'
                        >
                          <span className='text-xs font-medium truncate'>
                            {layer.name}
                          </span>
                          <Badge
                            variant='secondary'
                            className='text-xs px-1 py-0'
                          >
                            {layer.type}
                          </Badge>
                        </button>
                      )}
                    </div>

                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-4 w-4 p-0'
                      onClick={() => handleToggleLayerExpanded(layer.id)}
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </Button>

                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-4 w-4 p-0'
                      onClick={() => handleRemoveGlobalLayer(layer.id)}
                      title='Remove Layer'
                    >
                      <Trash2 className='w-3 h-3' />
                    </Button>
                  </div>

                  {/* Layer Controls */}
                  {isExpanded && (
                    <div className='px-2 pb-2 space-y-3 border-t'>
                      {/* Layer-specific controls */}
                      {layer.type === "adjustment" && (
                        <div className='space-y-2'>
                          <div className='flex items-center gap-1'>
                            <Settings className='w-3 h-3' />
                            <Label className='text-xs'>Parameters</Label>
                          </div>
                          {Object.entries(layer.parameters).map(
                            ([paramKey, paramValue]) => (
                              <div key={paramKey} className='space-y-1'>
                                <div className='flex items-center justify-between'>
                                  <Label className='text-xs'>
                                    {capitalize(paramKey)}
                                  </Label>
                                  <span className='text-xs w-8 text-right'>
                                    {typeof paramValue === "number"
                                      ? paramValue
                                      : paramValue.value}
                                  </span>
                                </div>
                                <Slider
                                  value={[
                                    typeof paramValue === "number"
                                      ? paramValue
                                      : paramValue.value,
                                  ]}
                                  onValueChange={([val]) =>
                                    handleUpdateGlobalLayerParameter(
                                      layer.id,
                                      paramKey,
                                      val
                                    )
                                  }
                                  min={0}
                                  max={200}
                                  step={1}
                                  className='h-2'
                                />
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {layer.type === "solid" && (
                        <div className='space-y-2'>
                          <div className='flex items-center gap-1'>
                            <Palette className='w-3 h-3' />
                            <Label className='text-xs'>Color</Label>
                          </div>
                          <div className='flex items-center gap-2'>
                            <div
                              className='w-8 h-6 border rounded cursor-pointer'
                              style={{
                                backgroundColor: `rgba(${Math.round(layer.color[0] * 255)}, ${Math.round(layer.color[1] * 255)}, ${Math.round(layer.color[2] * 255)}, ${layer.color[3]})`,
                              }}
                              onClick={() => {
                                // Simple color picker - in a real implementation, you'd use a proper color picker component
                                const newColor = [
                                  Math.random(),
                                  Math.random(),
                                  Math.random(),
                                  layer.color[3],
                                ] as [number, number, number, number]
                                handleUpdateSolidLayerColor(layer.id, newColor)
                              }}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  const newColor = [
                                    Math.random(),
                                    Math.random(),
                                    Math.random(),
                                    layer.color[3],
                                  ] as [number, number, number, number]
                                  handleUpdateSolidLayerColor(
                                    layer.id,
                                    newColor
                                  )
                                }
                              }}
                              role='button'
                              tabIndex={0}
                              title='Click to randomize color'
                            />
                            <div className='flex-1 text-xs text-muted-foreground'>
                              RGBA:{" "}
                              {layer.color
                                .map((v) => Math.round(v * 255))
                                .join(", ")}
                            </div>
                          </div>
                        </div>
                      )}

                      {layer.type === "mask" && (
                        <div className='space-y-2'>
                          <div className='flex items-center gap-1'>
                            <svg
                              className='w-3 h-3'
                              viewBox='0 0 24 24'
                              fill='currentColor'
                              aria-label='Mask settings icon'
                            >
                              <title>Mask settings icon</title>
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
                              <circle
                                cx='13'
                                cy='12'
                                r='4'
                                fill='currentColor'
                              />
                            </svg>
                            <Label className='text-xs'>Mask Settings</Label>
                          </div>
                          <div className='space-y-2'>
                            <div className='flex items-center justify-between'>
                              <Label className='text-xs'>Enabled</Label>
                              <Button
                                variant={layer.enabled ? "default" : "outline"}
                                size='sm'
                                className='h-5 px-2 text-xs'
                                onClick={() =>
                                  handleUpdateMaskLayerEnabled(
                                    layer.id,
                                    !layer.enabled
                                  )
                                }
                              >
                                {layer.enabled ? "On" : "Off"}
                              </Button>
                            </div>
                            <div className='flex items-center justify-between'>
                              <Label className='text-xs'>Inverted</Label>
                              <Button
                                variant={layer.inverted ? "default" : "outline"}
                                size='sm'
                                className='h-5 px-2 text-xs'
                                onClick={() =>
                                  handleUpdateMaskLayerInverted(
                                    layer.id,
                                    !layer.inverted
                                  )
                                }
                              >
                                {layer.inverted ? "Yes" : "No"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className='flex items-center gap-1 pb-2 border-t'>
        <AdjustmentLayersMenu
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive}
          handleAddAdjustmentLayer={handleAddGlobalAdjustmentLayer}
        />
        <FxLayersMenu
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive}
          handleAddAdjustmentLayer={handleAddGlobalAdjustmentLayer}
        />
      </div>
    </div>
  )
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function LayersPanelInner({
  className,
  setSelectedSidebar,
  allowAddMultipleImages = false,
  ...props
}: LayersPanelProps) {
  const { isGlobalDragActive } = React.useContext(LayerContext)

  const {
    addAdjustmentLayer,
    addImageLayer,
    duplicateLayer,
    getOrderedLayers,
    getSelectedLayerId,
    removeLayer,
    reorderLayer,
    reorderLayers,
    selectLayer,
    setBlendMode,
    setLayerName,
    setOpacity,
    toggleGroupCollapse,
    toggleLock,
    toggleVisibility,
    ungroupLayer,
    updateLayer,
    state,
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

  const handleBlendModeChange = useBlendModeChange({ isDragActive })

  const handleOpacityChange = useOpacityChange({ isDragActive })

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
        colorize: {
          colorizeHue: (TOOL_VALUES as any).colorizeHue.defaultValue,
          colorizeSaturation: (TOOL_VALUES as any).colorizeSaturation
            .defaultValue,
          colorizeLightness: (TOOL_VALUES as any).colorizeLightness
            .defaultValue,
          colorizeAmount: (TOOL_VALUES as any).colorizeAmount.defaultValue,
          colorizePreserveLum: (TOOL_VALUES as any).colorizePreserveLum
            .defaultValue,
        },
        vibrance: { vibrance: TOOL_VALUES.vibrance.defaultValue as number },
        vintage: { vintage: TOOL_VALUES.vintage.defaultValue as number },
        grayscale: { grayscale: TOOL_VALUES.grayscale.defaultValue as number },
        invert: { invert: TOOL_VALUES.invert.defaultValue as number },
        sepia: { sepia: TOOL_VALUES.sepia.defaultValue as number },
        solid: { solid: (TOOL_VALUES.solid as any).defaultValue },
        sharpen: {
          sharpenAmount: (TOOL_VALUES as any).sharpenAmount.defaultValue,
          sharpenRadius: (TOOL_VALUES as any).sharpenRadius.defaultValue,
          sharpenThreshold: (TOOL_VALUES as any).sharpenThreshold.defaultValue,
        },
        noise: {
          noiseAmount: (TOOL_VALUES as any).noiseAmount.defaultValue,
          noiseSize: (TOOL_VALUES as any).noiseSize.defaultValue,
        },
        gaussian: {
          gaussianAmount: (TOOL_VALUES as any).gaussianAmount.defaultValue,
          gaussianRadius: (TOOL_VALUES as any).gaussianRadius.defaultValue,
        },
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

  const isDocumentLayerSelected = selectedLayerId === "document"

  return (
    <div className={cn("w-full space-y-2", className)} {...props}>
      <div className='flex items-center  h-12 p-2 text-xs justify-between border-b gap-2'>
        <BlendModesControls
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive}
          isDocumentLayerSelected={isDocumentLayerSelected}
          handleBlendModeChange={handleBlendModeChange}
          selectedLayerId={selectedLayerId}
        />

        <OpacityControls
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive}
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

        <AdjustmentLayersMenu
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive}
          handleAddAdjustmentLayer={handleAddAdjustmentLayer}
        />

        <FxLayersMenu
          isDragActive={isDragActive}
          isGlobalDragActive={isGlobalDragActive}
          handleAddAdjustmentLayer={handleAddAdjustmentLayer}
        />

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
      <Tabs defaultValue='document' className='w-full'>
        <TabsList className='w-full rounded-none'>
          <TabsTrigger value='layers' className='w-full'>
            Layers
          </TabsTrigger>
          <TabsTrigger value='document' className='w-full'>
            Document
          </TabsTrigger>
        </TabsList>
        <TabsContent value='layers'>
          <LayersPanelInner {...props} />
        </TabsContent>
        <TabsContent value='document'>
          <DocumentPanel />
        </TabsContent>
      </Tabs>
    </LayerContext.Provider>
  )
}

export interface AdjustmentLayersMenuProps {
  isDragActive: boolean
  isGlobalDragActive: React.RefObject<boolean>
  handleAddAdjustmentLayer: (adjustmentType: string) => void
}
export function AdjustmentLayersMenu({
  isDragActive,
  isGlobalDragActive,
  handleAddAdjustmentLayer,
}: AdjustmentLayersMenuProps) {
  return (
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
            onClick={() => handleAddAdjustmentLayer("colorize")}
          >
            <Palette className='w-3 h-3 mr-1' />
            Colorize
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
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("tint")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Tint
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface FxLayersMenuProps {
  isDragActive: boolean
  isGlobalDragActive: React.RefObject<boolean>
  handleAddAdjustmentLayer: (fxType: string) => void
}
export function FxLayersMenu({
  isDragActive,
  isGlobalDragActive,
  handleAddAdjustmentLayer,
}: FxLayersMenuProps) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            title='Add FX layer'
            variant='ghost'
            size='sm'
            className='h-8 w-8 p-0 rounded-sm'
          >
            {" "}
            <FxIcon className='w-4 h-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='bg-background p-2 border rounded-sm'>
          <div className='grid grid-cols-2 gap-1'>
            <Button
              variant='ghost'
              size='sm'
              className='text-xs h-8 justify-start rounded-sm'
              onClick={() => handleAddAdjustmentLayer("sharpen")}
            >
              <Eclipse className='w-3 h-3 mr-1' />
              Sharpen
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-xs h-8 justify-start rounded-sm'
              onClick={() => handleAddAdjustmentLayer("noise")}
            >
              <Eclipse className='w-3 h-3 mr-1' />
              Noise
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-xs h-8 justify-start rounded-sm'
              onClick={() => handleAddAdjustmentLayer("gaussian")}
            >
              <Eclipse className='w-3 h-3 mr-1' />
              Gaussian Blur
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export interface BlendModesControlsProps extends React.ComponentProps<"div"> {
  isDragActive: boolean
  isGlobalDragActive: React.RefObject<boolean>
  isDocumentLayerSelected: boolean

  selectedLayerId: string | null
  handleBlendModeChange: (layerId: string, blendMode: BlendMode) => void
}

export function BlendModesControls({
  isDragActive,
  isGlobalDragActive,
  isDocumentLayerSelected,
  selectedLayerId,
  handleBlendModeChange,
  className,
  ...props
}: BlendModesControlsProps) {
  const currentLayer = useCurrentLayer({
    selectedLayerId,
    isDocumentLayerSelected,
  })

  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      <div className='text-xs'>Blend:</div>
      {/* Blend Mode Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-xs'
            disabled={
              isDragActive || isGlobalDragActive.current || !selectedLayerId
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
                handleBlendModeChange(selectedLayerId, mode as BlendMode)
              }
            >
              {name}
            </Button>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export interface OpacityControlsProps extends React.ComponentProps<"div"> {
  isDragActive: boolean
  isGlobalDragActive: React.RefObject<boolean>
  isDocumentLayerSelected: boolean
  selectedLayerId: string | null
  handleOpacityChange: (layerId: string, opacity: number) => void
}

export function OpacityControls({
  isDragActive,
  isGlobalDragActive,
  isDocumentLayerSelected,
  selectedLayerId,
  handleOpacityChange,
}: OpacityControlsProps) {
  const currentLayer = useCurrentLayer({
    selectedLayerId,
    isDocumentLayerSelected,
  })

  console.log(currentLayer)

  return (
    <div className='flex items-center gap-2'>
      <span className='text-xs'>Opacity:</span>
      <div className='flex items-center border rounded-sm h-9'>
        <Input
          type='number'
          min='0'
          max='100'
          value={currentLayer?.opacity ?? 100}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            selectedLayerId &&
            handleOpacityChange(
              selectedLayerId as string,
              Number(e.target.value)
            )
          }
          className=' px-2 py-1 h-8 border-none'
          disabled={
            isDragActive || isGlobalDragActive.current || !selectedLayerId
          }
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='size-8 p-0 rounded-sm'
              disabled={
                isDragActive || isGlobalDragActive.current || !selectedLayerId
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
                  selectedLayerId &&
                  handleOpacityChange(
                    selectedLayerId as string,
                    Number(e.target.value)
                  )
                }
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
                className='h-1 bg-secondary rounded-lg appearance-none cursor-pointer'
                disabled={
                  isDragActive || isGlobalDragActive.current || !selectedLayerId
                }
              />
              <span className='text-xs w-8'>{currentLayer?.opacity || 0}%</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
