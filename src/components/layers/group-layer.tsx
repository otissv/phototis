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
      const nextChildren = currentChildren.map((c: any) =>
        c.id === child.id ? { ...c, ...patch, id: c.id } : c
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
          onDuplicate={() => {}}
          onSelect={onSelect}
          onToggleVisibility={() =>
            handleUpdateChild({ visible: !(child as any).visible })
          }
          onToggleLock={() =>
            handleUpdateChild({ locked: !(child as any).locked })
          }
          onNameChange={(name) => handleUpdateChild({ name })}
          onOpacityChange={() => {}}
          onMoveLayer={onMoveChild}
          type='group-layer'
          parentGroupId={groupLayer.id}
        />
      </div>
    </div>
  )
}
