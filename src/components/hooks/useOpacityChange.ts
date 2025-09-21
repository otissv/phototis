"use client"

import React from "react"

import { useEditorContext } from "@/lib/editor/context"

export function useOpacityChange({ isDragActive }: { isDragActive: boolean }) {
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
