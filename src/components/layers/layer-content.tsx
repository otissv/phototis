"use client"

import { useCallback, useState, useEffect } from "react"
import {
  Copy,
  Eye,
  EyeOff,
  Layers,
  Lock,
  MoreHorizontal,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react"

import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
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
  isDragActive?: boolean
  onDelete: () => void
  onDuplicate: () => void
  onNameChange: (name: string) => void
  onOpacityChange: (opacity: number) => void
  onSelect: (layerId: string) => void
  onToggleGroupCollapse?: () => void
  onToggleLock: () => void
  onToggleVisibility: () => void
  onUngroup?: () => void
}

export function LayerItemContent({
  isDragActive = false,
  layer,
  onDelete,
  onDuplicate,
  onNameChange,
  onSelect,
  onToggleGroupCollapse,
  onToggleLock,
  onToggleVisibility,
  onUngroup,
}: LayerItemContentProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(layer.name)
  const { getSelectedLayerId, updateLayer } = useEditorContext()
  const { history, getOrderedLayers } = useEditorContext()

  const layers = getOrderedLayers()
  const selectedLayerId = getSelectedLayerId()

  const isSelected = selectedLayerId === layer.id

  const handleMoveChildInGroup = useCallback(
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

  const handleMoveChildToTopLevel = useCallback(
    (groupId: string, childId: string) => {
      // Move child from group to top level
      const groupLayer = layer as any
      if (groupLayer.type !== "group" || !groupLayer.children) return

      const child = groupLayer.children.find((c: any) => c.id === childId)
      if (!child) return

      // Remove child from group
      const updatedChildren = groupLayer.children.filter(
        (c: any) => c.id !== childId
      )

      // Add the child to the top level

      const groupIndex = layers.findIndex((l) => l.id === groupId)

      history.begin("Move layer to top level")

      // If group becomes empty, remove the group entirely
      if (updatedChildren.length === 0) {
        history.push(new RemoveLayerCommand(groupId))
      } else {
        // Update group with remaining children
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
    [layer, history.begin, history.push, history.end, layers.findIndex]
  )

  const handleNameSubmit = useCallback(() => {
    if (isDragActive) return
    onNameChange(editName)
    setIsEditing(false)
  }, [editName, onNameChange, isDragActive])

  const handleNameKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
      data-id={layer.id}
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
              onClick={(e: MouseEvent) => {
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
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                onToggleLock()
              }}
              disabled={isDragActive}
            >
              {layer.locked ? (
                <Lock className={cn("w-3 h-3")} />
              ) : (
                <Unlock className='w-3 h-3' />
              )}
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
                    <DropdownMenuItem
                      onSelect={() => onToggleGroupCollapse()}
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
                          <ListChevronsUpDown className='size-4' /> Expand group
                        </>
                      ) : (
                        <>
                          <ListChevronsDownUp className='size-4' /> Collapse
                          group
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {onUngroup && (
                    <DropdownMenuItem
                      onSelect={() => onUngroup()}
                      className='gap-2 justify-start rounded-sm cursor-pointer text-sm'
                      disabled={isDragActive}
                      title='Ungroup layers'
                    >
                      <Ungroup className='size-4' /> Ungroup layers
                    </DropdownMenuItem>
                  )}
                </>
              )}

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
          onSelect={onSelect}
        />
      )}
    </div>
  )
}

// Thumbnail component for layer preview
export function LayerThumbnail({ layer }: { layer: EditorLayer }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  useEffect(() => {
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
      <div className='w-6 h-6 rounded-xs overflow-hidden border  flex items-center justify-center'>
        {icon}
      </div>
    )
  }

  if (layer.type === "group") {
    // Show group layer icon
    return (
      <div className='w-6 h-6 rounded-xs overflow-hidden border  flex items-center justify-center'>
        <Layers className='w-3 h-3' />
      </div>
    )
  }

  if (layer.type === "solid") {
    // Show solid color layer
    const solid = layer as any
    return (
      <div
        className='w-6 h-6 rounded-xs overflow-hidden border '
        style={{ backgroundColor: `rgba(${solid.color.join(",")})` }}
      />
    )
  }

  if (!thumbnailUrl) {
    return <div className='size-6' />
  }

  return (
    <div className='w-6 h-6 rounded-xs overflow-hidden border '>
      <img
        src={thumbnailUrl}
        alt={layer.name}
        className='w-full h-full object-cover'
      />
    </div>
  )
}
