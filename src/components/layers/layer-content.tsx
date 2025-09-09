"use client"

import React from "react"
import {
  Copy,
  Eye,
  EyeOff,
  Layers,
  Lock,
  MoreHorizontal,
  Trash2,
  Ungroup,
} from "lucide-react"

import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { useEditorContext } from "@/lib/editor/context"
import type { EditorLayer, AdjustmentLayer } from "@/lib/editor/state"
import {
  AddLayerCommand,
  RemoveLayerCommand,
  UpdateLayerCommand,
} from "@/lib/editor/commands"
import { getAdjustmentIcon } from "@/components/layers/adjustment.layer"
import { ListChevronsUpDown } from "@/ui/icons/list-chevrons-up-down"
import { ListChevronsDownUp } from "@/ui/icons/list-chevrons-down-up"
import { GroupChildrenContainer } from "@/components/layers/group-layer"

export interface LayerItemContentProps {
  layer: EditorLayer
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onNameChange: (name: string) => void
  onOpacityChange: (opacity: number) => void
  isDragActive?: boolean
  onUngroup?: () => void
  onToggleGroupCollapse?: () => void
  isSelected?: boolean
}

export function LayerItemContent({
  layer,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onNameChange,
  isDragActive = false,
  onUngroup,
  onToggleGroupCollapse,
  isSelected = false,
}: LayerItemContentProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editName, setEditName] = React.useState(layer.name)
  const { reorderLayers, ungroupLayer, updateLayer, removeLayer } =
    useEditorContext()

  const handleMoveChildInGroup = React.useCallback(
    (groupId: string, fromIndex: number, toIndex: number) => {
      // Move child within the group
      const groupLayer = layer as any
      if (groupLayer.type !== "group" || !groupLayer.children) return

      const children = [...groupLayer.children]
      const [movedChild] = children.splice(fromIndex, 1)
      children.splice(toIndex, 0, movedChild)

      // Update the group with new children order
      updateLayer(groupId, { children } as any)
    },
    [layer, updateLayer]
  )

  const handleMoveChildToTopLevel = React.useCallback(
    (groupId: string, childId: string) => {
      // Move child from group to top level
      const groupLayer = layer as any
      if (groupLayer.type !== "group" || !groupLayer.children) return

      const child = groupLayer.children.find((c: any) => c.id === childId)
      if (!child) return

      console.log(`Moving child ${childId} from group ${groupId} to top level`)

      // Remove child from group
      const updatedChildren = groupLayer.children.filter(
        (c: any) => c.id !== childId
      )

      // Add the child to the top level
      const { history, getOrderedLayers } = useEditorContext()
      const layers = getOrderedLayers()
      const groupIndex = layers.findIndex((l) => l.id === groupId)

      history.begin("Move layer to top level")

      // If group becomes empty, remove the group entirely
      if (updatedChildren.length === 0) {
        console.log(`Group ${groupId} is now empty, removing it`)
        history.push(new RemoveLayerCommand(groupId))
      } else {
        // Update group with remaining children
        console.log(
          `Updating group ${groupId} with ${updatedChildren.length} remaining children`
        )
        history.push(
          new UpdateLayerCommand(groupId, { children: updatedChildren } as any)
        )
      }

      // Create a new layer entry for the child at the top level
      const childAtTopLevel = {
        ...child,
        parentGroupId: undefined, // Remove parent group reference
      }

      // Add the child to the main layers at the group's position
      history.push(new AddLayerCommand(childAtTopLevel, groupIndex))

      history.end(true)
    },
    [layer]
  )

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
    <div
      className={cn(
        "rounded-sm",
        layer.type === "group" ? "border" : "hover:bg-primary/10"
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center px-2 rounded-t-sm rounded-b-none",
          layer.type === "image" && "rounded-b-sm",
          isSelected && "border-primary bg-primary/10",
          layer.parentGroupId && "border-l-2 border-muted/20"
          // !layer.parentGroupId && "rounded-none",
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
              {layer.type === "group" && (
                <>
                  {onToggleGroupCollapse && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        onToggleGroupCollapse()
                      }}
                      className='gap-2 justify-start rounded-sm cursor-pointer text-sm'
                      disabled={isDragActive}
                      title={
                        (layer as any).collapsed
                          ? "Expand group"
                          : "Collapse group"
                      }
                    >
                      {(layer as any).collapsed ? (
                        <>
                          {" "}
                          <ListChevronsUpDown className='size-4' /> Expand group
                        </>
                      ) : (
                        <>
                          {" "}
                          <ListChevronsDownUp className='size-4' /> Collapse
                          group
                        </>
                      )}
                    </Button>
                  )}
                  {onUngroup && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        onUngroup()
                      }}
                      className='gap-2 justify-start rounded-sm cursor-pointer text-sm'
                      disabled={isDragActive}
                      title='Ungroup layers'
                    >
                      <Ungroup className='size-4' /> Ungroup layers
                    </Button>
                  )}
                </>
              )}

              <Button
                variant='ghost'
                size='sm'
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
                className='gap-2 justify-start rounded-sm cursor-pointer text-sm'
                disabled={isDragActive}
                title='Duplicate layer'
              >
                <Copy className={cn("size-4")} /> Duplicate
              </Button>

              <Button
                variant='ghost'
                size='sm'
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className='gap-2 justify-start text-destructive rounded-sm cursor-pointer text-sm'
                disabled={isDragActive}
                title='Delete layer'
              >
                <Trash2 className={cn("size-4")} /> Delete
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {layer.type === "group" && (
        <GroupChildrenContainer
          groupLayer={layer}
          isSelected={isSelected}
          onMoveChild={(fromIndex, toIndex) =>
            handleMoveChildInGroup(layer.id, fromIndex, toIndex)
          }
          onMoveChildToTopLevel={(childId) =>
            handleMoveChildToTopLevel(layer.id, childId)
          }
        />
      )}
    </div>
  )
}

// Thumbnail component for layer preview
function LayerThumbnail({ layer }: { layer: EditorLayer }) {
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (layer.type === "image") {
      const file = (layer as any).image
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
    }
    // Clean up if no image or not an image layer
    setThumbnailUrl(null)
  }, [layer])

  if (layer.type === "adjustment") {
    // Show adjustment layer icon
    const adjustment = layer as AdjustmentLayer
    const icon = getAdjustmentIcon(adjustment.adjustmentType)
    return (
      <div className='w-6 h-6 rounded-xs overflow-hidden border border-border flex items-center justify-center'>
        {icon}
      </div>
    )
  }

  if (layer.type === "group") {
    // Show group layer icon
    return (
      <div className='w-6 h-6 rounded-xs overflow-hidden border border-border flex items-center justify-center'>
        <Layers className='w-3 h-3' />
      </div>
    )
  }

  if (layer.type === "solid") {
    // Show solid color layer
    const solid = layer as any
    return (
      <div
        className='w-6 h-6 rounded-xs overflow-hidden border border-border'
        style={{ backgroundColor: `rgba(${solid.color.join(",")})` }}
      />
    )
  }

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
