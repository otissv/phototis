"use client"

import React from "react"
import { useDrag, useDrop } from "react-dnd"
import { cn } from "@/lib/utils"

import { useEditorContext } from "@/lib/editor/context"
import type { EditorLayer, AdjustmentLayer } from "@/lib/editor/state"
import { AdjustmentLayerEditor } from "@/components/layers/adjustment.layer"
import { LayerItemContent } from "@/components/layers/layer-content"
import { LayerContext } from "@/components/layers/layer-panel"

// Drag item type for react-dnd
export type ItemType = "layer" | "group-layer"
export interface DragItem {
  id: string
  index: number
  type: ItemType
  parentGroupId?: string
  targetLayerId?: string
  isOverMiddle?: boolean
}

export interface DraggableLayerItemProps
  extends Prettify<Omit<React.ComponentProps<"div">, "onSelect">> {
  layer: EditorLayer
  index: number
  isSelected: boolean
  type: "layer" | "group-layer"
  parentGroupId?: string
  onSelect: (layerId: string) => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onNameChange: (name: string) => void
  onOpacityChange: (opacity: number) => void
  onMoveLayer: (fromIndex: number, toIndex: number) => void
  onUngroup?: () => void
  onToggleGroupCollapse?: () => void
}

export function DraggableLayerItem({
  layer,
  index,
  isSelected,
  parentGroupId,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  onNameChange,
  onOpacityChange,
  onMoveLayer,
  onUngroup,
  onToggleGroupCollapse,
  type = "layer",
  ...props
}: DraggableLayerItemProps) {
  const { isGlobalDragActive, dropHandled } = React.useContext(LayerContext)
  const {
    setEphemeral,
    updateAdjustmentParameters,
    createGroupLayer,
    ungroupLayer,
    updateLayer,
    getOrderedLayers,
    history,
    state,
    removeLayer,
    reorderLayer,
  } = useEditorContext()
  const [isOverMiddle, setIsOverMiddle] = React.useState(false)

  const layers = getOrderedLayers()

  const [{ isDragging }, drag] = useDrag<
    DragItem,
    void,
    { isDragging: boolean }
  >({
    type,
    item: { id: layer.id, index, type: type, parentGroupId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item: DragItem, monitor) => {
      // Prevent duplicate drop operations
      if (dropHandled.current) {
        return
      }

      dropHandled.current = true

      // Check if the item was dropped on a valid target
      const didDrop = monitor.didDrop()

      if (!didDrop && !item.targetLayerId) {
        // If this is a child from a group that was dropped outside, move it to top level
        if (item.parentGroupId) {
          const groupLayer = layers.find(
            (l) => l.id === item.parentGroupId
          ) as any

          if (
            groupLayer &&
            groupLayer.type === "group" &&
            groupLayer.children
          ) {
            const child = groupLayer.children.find(
              (child: any) => child.id === item.id
            )
            if (child) {
              // Find the group's position in the main layers order
              const groupIndex = layers.findIndex(
                (layer) => layer.id === item.parentGroupId
              )

              // Move the child to the main layers at the group's position atomically
              reorderLayer(child.id, { parentId: null, index: groupIndex })

              history.end(true)
            }
          }
        }
      }

      // Reset global drag state
      isGlobalDragActive.current = false
      dropHandled.current = false
    },
  })

  // Track drag state changes
  React.useEffect(() => {
    if (isDragging) {
      isGlobalDragActive.current = true
      dropHandled.current = false // Reset drop handled flag when starting new drag
    } else {
      isGlobalDragActive.current = false
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
  }, [isDragging, layer.id, setEphemeral, dropHandled, isGlobalDragActive])

  const [{ isOver }, drop] = useDrop({
    accept: (type === "layer" ? ["layer", "group-layer"] : type) as any,
    hover: (item: DragItem, monitor) => {
      // Avoid duplicate in-group reordering; GroupChildItem handles it
      if (type === "group-layer") {
        return
      }

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

        // Check if dragging over the middle area (30% to 70% of layer height) for grouping
        const middleThreshold = hoverBoundingRect.height * 0.3
        const isOverMiddle =
          hoverClientY >= middleThreshold &&
          hoverClientY <= hoverBoundingRect.height - middleThreshold

        // If dragging over the middle area, we'll handle grouping in the drop handler
        if (isOverMiddle) {
          // Set a flag to indicate we're over the middle for grouping
          ;(item as any).isOverMiddle = true
          ;(item as any).targetLayerId = layer.id
          setIsOverMiddle(true)
          return
        }
        // Clear grouping flags for edge drops
        ;(item as any).isOverMiddle = false
        ;(item as any).targetLayerId = undefined
        setIsOverMiddle(false)

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
    drop: (item: DragItem) => {
      // Prevent duplicate drop operations
      if (dropHandled.current) {
        return
      }

      if (type === "group-layer") {
        reorderLayer(item.id, { parentId: item.targetLayerId, index: index })
        return
      }

      if (item.type === "group-layer") {
        reorderLayer(item.id, { parentId: null, index: index })
        return
      }

      const draggedLayerId = item.id
      const targetLayerId = layer.id

      // Don't group a layer with itself
      if (draggedLayerId === targetLayerId) {
        return
      }

      dropHandled.current = true
      if (layer.type === "group") {
        const draggedLayer = getOrderedLayers().find(
          (l) => l.id === draggedLayerId
        )

        if (draggedLayer?.type === "group") {
          return
        }

        // Atomically move into the target group at the end
        const insertIndex = layer.children?.length ?? 0
        reorderLayer(draggedLayerId, {
          parentId: targetLayerId,
          index: insertIndex,
        })
        return
      }

      if (item.isOverMiddle && item.targetLayerId) {
        // Prevent grouping when either side is a group
        const draggedTop = getOrderedLayers().find(
          (l) => l.id === draggedLayerId
        )
        if (draggedTop && draggedTop.type === "group") {
          console.warn("Skipping: cannot create a group containing a group")
          return
        }

        // Create a group with the dragged layer and target layer
        const groupLayerName = `Group ${layers.filter((layer) => layer.type === "group").length + 1}`
        createGroupLayer([draggedLayerId, targetLayerId], groupLayerName)
      }
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

  const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    const layerId = (e.currentTarget as HTMLElement).dataset.id || ""
    onSelect(layerId)
  }

  return (
    <div {...props}>
      <div
        data-id={layer.id}
        ref={ref}
        className={cn(
          "cursor-pointer transition-colors w-full text-left rounded-sm space-y-1",
          isDragging && "opacity-50",
          isOver && "border-primary/50",
          isOverMiddle && "border-blue-500 bg-blue-500/20"
        )}
        onClick={(e: React.MouseEvent) => {
          handleSelect(e)
        }}
        aria-label={`Select layer ${layer.name}`}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") {
            handleSelect(e)
          }
        }}
      >
        <LayerItemContent
          isDragActive={isDragging || isGlobalDragActive.current}
          layer={layer}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onNameChange={onNameChange}
          onOpacityChange={onOpacityChange}
          onSelect={onSelect}
          onToggleGroupCollapse={onToggleGroupCollapse}
          onToggleLock={onToggleLock}
          onToggleVisibility={onToggleVisibility}
          onUngroup={onUngroup}
        />
      </div>
      {layer.type === "adjustment" && isSelected && (
        <div>
          <AdjustmentLayerEditor
            layer={layer as AdjustmentLayer}
            onUpdate={(parameters) => {
              updateAdjustmentParameters(layer.id, parameters as any)
            }}
          />
        </div>
      )}
    </div>
  )
}
