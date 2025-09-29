"use client"

import { useContext, useCallback, useRef, useEffect } from "react"
import { useDrag, useDrop } from "react-dnd"

import { cn } from "@/lib/utils"
import type { EditorLayer } from "@/lib/editor/state"
import {
  DraggableLayerItem,
  type DragItem,
} from "@/components/layers/draggable-layer"
import { useEditorContext } from "@/lib/editor/context"
import { LayerContext } from "@/components/layers/layer-panel"

export interface GroupChildrenContainerProps {
  groupLayer: EditorLayer
  isSelected: boolean
  onMoveChild: (fromIndex: number, toIndex: number) => void
  onMoveChildToTopLevel: (childId: string) => void
  onSelect: (layerId: string) => void
}

export function GroupChildrenContainer({
  groupLayer,
  isSelected,
  onMoveChild,
  onSelect,
}: GroupChildrenContainerProps) {
  const groupLayerTyped = groupLayer as any
  const children = groupLayerTyped.children || []

  return (
    <div>
      {children.map((child: EditorLayer, index: number) => (
        <GroupChildItem
          key={child.id}
          child={child}
          index={index}
          groupLayer={groupLayer}
          isSelected={isSelected}
          onMoveChild={onMoveChild}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export interface GroupChildItemProps {
  child: EditorLayer
  index: number
  groupLayer: EditorLayer
  isSelected: boolean
  onMoveChild: (fromIndex: number, toIndex: number) => void
  onSelect: (layerId: string) => void
}

export function GroupChildItem({
  child,
  index,
  groupLayer,
  isSelected,
  onMoveChild,
  onSelect,
}: GroupChildItemProps) {
  const { dropHandled } = useContext(LayerContext)
  const { updateLayer, removeLayer, reorderLayer } = useEditorContext()

  const handleUpdateChild = useCallback(
    (patch: Partial<EditorLayer>) => {
      const parent = groupLayer as any
      const currentChildren = Array.isArray(parent.children)
        ? parent.children
        : []

      const nextChildren = currentChildren.map((c: any) => {
        if (c.id === child.id) {
          // Only update the specific child with the patch, preserving all other properties
          const updated = { ...c, ...patch }
          return updated
        }
        // Return other children unchanged
        return c
      })

      updateLayer(parent.id, { children: nextChildren } as any)
    },
    [groupLayer, child, updateLayer]
  )

  const handleDeleteChild = useCallback(() => {
    const parent = groupLayer as any
    const currentChildren = Array.isArray(parent.children)
      ? parent.children
      : []
    const nextChildren = currentChildren.filter((c: any) => c.id !== child.id)
    if (nextChildren.length === 0) {
      // Remove empty group entirely
      removeLayer(parent.id)
    } else {
      updateLayer(parent.id, { children: nextChildren } as any)
    }
  }, [groupLayer, child, updateLayer, removeLayer])

  const handleDuplicateChild = useCallback(() => {
    // For group children, we need to duplicate the child and add it to the group
    const parent = groupLayer as any
    const currentChildren = Array.isArray(parent.children)
      ? parent.children
      : []

    // Create a duplicate of the child
    const duplicatedChild = {
      ...child,
      id: `layer-${Date.now()}`,
      name: `${child.name} (Copy)`,
    }

    // Add the duplicated child to the group
    const nextChildren = [...currentChildren, duplicatedChild]
    updateLayer(parent.id, { children: nextChildren } as any)
  }, [groupLayer, child, updateLayer])

  const handleToggleChildVisibility = useCallback(() => {
    // Group children are stored within the group's children array, not in the main layers.byId
    // So we need to update the child within the group's children array
    handleUpdateChild({ visible: !child.visible })
  }, [child.visible, handleUpdateChild])

  const handleToggleChildLock = useCallback(() => {
    // Group children are stored within the group's children array, not in the main layers.byId
    // So we need to update the child within the group's children array
    handleUpdateChild({ locked: !child.locked })
  }, [child.locked, handleUpdateChild])

  const handleChildOpacityChange = useCallback(
    (opacity: number) => {
      // Group children are stored within the group's children array, not in the main layers.byId
      // So we need to update the child within the group's children array
      handleUpdateChild({ opacity })
    },
    [handleUpdateChild]
  )

  const [{ isDragging }, drag] = useDrag<
    DragItem,
    void,
    { isDragging: boolean }
  >({
    type: "group-layer",
    item: {
      id: child.id,
      index,
      type: "group-layer",
      parentGroupId: groupLayer.id,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: "group-layer",
    hover: (item: DragItem, monitor) => {
      try {
        if (!item || item.id === child.id) {
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

        // Only reorder when dragging within the same group
        if (item.parentGroupId === (groupLayer as any).id) {
          onMoveChild(dragIndex, hoverIndex)
          // Keep the drag item's index in sync to avoid extra splices
          item.index = hoverIndex
        }
      } catch (error) {
        // Silently handle React DnD errors during drag operations
        console.warn("React DnD hover error:", error)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    canDrop: () => {
      return true
    },
    drop: () => {
      // Cross-group moves are handled by the outer drop target
      return
    },
  })

  const ref = useRef<HTMLDivElement>(null)
  drag(drop(ref))

  // Track drag state changes for GroupChildItem
  useEffect(() => {
    if (isDragging) {
      dropHandled.current = false // Reset drop handled flag when starting new drag
    }
  }, [isDragging, dropHandled])

  return (
    <div className='ml-1 p-1'>
      <div
        ref={ref}
        className={cn(
          "cursor-pointer transition-colors w-full text-left",
          isDragging && "opacity-50",
          isOver && "border-primary/30"
        )}
      >
        <DraggableLayerItem
          id={child.id}
          index={index}
          isSelected={isSelected}
          layer={child}
          onDelete={handleDeleteChild}
          onDuplicate={handleDuplicateChild}
          onSelect={onSelect}
          onToggleVisibility={handleToggleChildVisibility}
          onToggleLock={handleToggleChildLock}
          onNameChange={(name) => handleUpdateChild({ name })}
          onOpacityChange={handleChildOpacityChange}
          onMoveLayer={onMoveChild}
          type='group-layer'
          parentGroupId={groupLayer.id}
        />
      </div>
    </div>
  )
}
