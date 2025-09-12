"use client"

import React from "react"

import { useDrag, useDrop } from "react-dnd"

import { cn } from "@/lib/utils"
import type { EditorLayer } from "@/lib/editor/state"
import {
  DraggableLayerItem,
  type DragItem,
} from "@/components/layers/draggable-layer"
import { useEditorContext } from "@/lib/editor/context"
import { LayerContext } from "./layer-panel"

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
  const { dropHandled } = React.useContext(LayerContext)
  const { updateLayer, removeLayer, reorderLayer } = useEditorContext()

  const handleUpdateChild = React.useCallback(
    (patch: Partial<EditorLayer>) => {
      const parent = groupLayer as any
      const currentChildren = Array.isArray(parent.children)
        ? parent.children
        : []

      console.log(`[GroupChild] Updating child ${child.id} with patch:`, patch)
      console.log(
        `[GroupChild] Current children:`,
        currentChildren.map((c: any) => ({ id: c.id, opacity: c.opacity }))
      )

      const nextChildren = currentChildren.map((c: any) => {
        if (c.id === child.id) {
          // Only update the specific child with the patch, preserving all other properties
          const updated = { ...c, ...patch }
          console.log(`[GroupChild] Updated child ${c.id}:`, {
            id: updated.id,
            opacity: updated.opacity,
          })
          return updated
        }
        // Return other children unchanged
        console.log(`[GroupChild] Keeping child ${c.id} unchanged:`, {
          id: c.id,
          opacity: c.opacity,
        })
        return c
      })

      console.log(
        `[GroupChild] Final children:`,
        nextChildren.map((c: any) => ({ id: c.id, opacity: c.opacity }))
      )
      updateLayer(parent.id, { children: nextChildren } as any)
    },
    [groupLayer, child, updateLayer]
  )

  const handleDeleteChild = React.useCallback(() => {
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

  const handleDuplicateChild = React.useCallback(() => {
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

  const handleToggleChildVisibility = React.useCallback(() => {
    // Group children are stored within the group's children array, not in the main layers.byId
    // So we need to update the child within the group's children array
    handleUpdateChild({ visible: !child.visible })
  }, [child.visible, handleUpdateChild])

  const handleToggleChildLock = React.useCallback(() => {
    // Group children are stored within the group's children array, not in the main layers.byId
    // So we need to update the child within the group's children array
    handleUpdateChild({ locked: !child.locked })
  }, [child.locked, handleUpdateChild])

  const handleChildOpacityChange = React.useCallback(
    (opacity: number) => {
      // Group children are stored within the group's children array, not in the main layers.byId
      // So we need to update the child within the group's children array
      console.log(
        `[GroupChild] Changing opacity for child ${child.id} to ${opacity}`
      )
      handleUpdateChild({ opacity })
    },
    [handleUpdateChild, child.id]
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

        // Time to actually perform the action
        onMoveChild(dragIndex, hoverIndex)

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
      return true
    },
    drop: (item: DragItem) => {
      // Prevent duplicate drop operations
      if (dropHandled.current) {
        return
      }

      // Check if we're dropping a child from the same group
      if (item.parentGroupId === groupLayer.id) {
        return
      }

      // Mover between groups
      if (item.parentGroupId && item.parentGroupId !== groupLayer.id) {
        dropHandled.current = true
      }
    },
  })

  const ref = React.useRef<HTMLDivElement>(null)
  drag(drop(ref))

  // Track drag state changes for GroupChildItem
  React.useEffect(() => {
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
