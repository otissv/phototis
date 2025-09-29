"use client"

import { useMemo } from "react"

import { useEditorContext } from "@/lib/editor/context"

export function useCurrentLayer({
  selectedLayerId,
  isDocumentLayerSelected,
}: {
  selectedLayerId: string | null
  isDocumentLayerSelected: boolean
}) {
  const { getOrderedLayers, getGlobalLayers } = useEditorContext()
  const layers = getOrderedLayers()

  const currentLayer = useMemo(() => {
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

  if (isDocumentLayerSelected) {
    const globalLayers = getGlobalLayers()
    return globalLayers.find((layer) => layer.id === selectedLayerId)
  }

  return currentLayer
}
