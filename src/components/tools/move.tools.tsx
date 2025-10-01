"use client"

import { useRef, useCallback, useEffect, useState } from "react"

import type { EditorContextValue } from "@/lib/editor/context"
import type { LayerDimensions } from "@/components/canvas.image-editor"

export type UseMoveArgs = {
  state: EditorContextValue["state"]
  selectedLayerId: string
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  layerDimensionsRef: React.RefObject<Map<string, LayerDimensions>>
  canvasDimensions: { width: number; height: number }
  updateLayer: (id: string, layer: any) => void
  setIsElementDragging: React.Dispatch<React.SetStateAction<boolean>>
  drawRef: React.RefObject<() => void>
  history: EditorContextValue["history"]
  scale: number
}

export function useMove({
  state,
  selectedLayerId,
  canvasRef,
  layerDimensionsRef,
  canvasDimensions,
  updateLayer,
  setIsElementDragging,
  drawRef,
  history,
  scale,
}: UseMoveArgs) {
  const isDraggingRef = useRef(false)
  const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragLayerSizeRef = useRef<{
    width: number
    height: number
  } | null>(null)

  const getRelativePointer = useCallback(
    (e: PointerEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    },
    [canvasRef]
  )

  const resetDrag = useCallback(() => {
    isDraggingRef.current = false
    dragStartPointerRef.current = null
    dragStartPosRef.current = null
    dragLayerSizeRef.current = null
    setIsElementDragging(false)
  }, [setIsElementDragging])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // @ts-expect-error this is a valid active tool and is intentional
    const isMoveTool = state.canonical.activeTool.tool === "move"
    if (!isMoveTool) {
      try {
        canvas.style.cursor = ""
      } catch {}
      return
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const pos = getRelativePointer(e)
      if (!pos) return

      const dims = layerDimensionsRef.current.get(selectedLayerId)
      if (!dims) return

      const withinX = pos.x >= dims.x && pos.x <= dims.x + dims.width
      const withinY = pos.y >= dims.y && pos.y <= dims.y + dims.height
      if (!withinX || !withinY) return

      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {}
      isDraggingRef.current = true
      dragStartPointerRef.current = pos
      dragStartPosRef.current = { x: dims.x, y: dims.y }
      dragLayerSizeRef.current = { width: dims.width, height: dims.height }
      setIsElementDragging(true)
      e.preventDefault()
      e.stopPropagation()
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      const startPointer = dragStartPointerRef.current
      const startPos = dragStartPosRef.current
      const size = dragLayerSizeRef.current
      if (!startPointer || !startPos || !size) return
      const pos = getRelativePointer(e)
      if (!pos) return

      const s = Math.max(0.01, Number.isFinite(scale) ? scale : 1)
      const dx = (pos.x - startPointer.x) / s
      const dy = (pos.y - startPointer.y) / s

      // Allow moving beyond canvas edges in all cases (off-canvas positions)
      const minX = -size.width
      const maxX = canvasDimensions.width
      const minY = -size.height
      const maxY = canvasDimensions.height
      const nx = Math.max(minX, Math.min(maxX, Math.round(startPos.x + dx)))
      const ny = Math.max(minY, Math.min(maxY, Math.round(startPos.y + dy)))

      try {
        const existing = layerDimensionsRef.current.get(selectedLayerId)
        const type = (existing?.type as any) || "image"
        layerDimensionsRef.current.set(selectedLayerId, {
          layerId: selectedLayerId,
          type,
          width: size.width,
          height: size.height,
          x: nx,
          y: ny,
        })
      } catch {}

      try {
        drawRef.current?.()
      } catch {}
    }

    const handlePointerUpOrCancel = (_e: PointerEvent) => {
      if (!isDraggingRef.current) return
      const dims = layerDimensionsRef.current.get(selectedLayerId)
      const current = state.canonical.layers.byId[selectedLayerId] as any
      const currentFilters = (current?.filters || {}) as any
      if (dims) {
        const nextFilters = {
          ...currentFilters,
          dimensions: {
            ...(currentFilters.dimensions || {}),
            width: dims.width,
            height: dims.height,
            x: dims.x,
            y: dims.y,
          },
        }
        try {
          history.begin("Move Layer")
          updateLayer(selectedLayerId, { filters: nextFilters } as any)
          history.end(true)
        } catch {}
      }
      resetDrag()
    }

    // Hover feedback for cursor when over selected layer
    const handleHoverMove = (e: PointerEvent) => {
      if (!canvas) return
      if (isDraggingRef.current) return
      const rp = getRelativePointer(e)
      if (!rp) return
      const s = Math.max(0.01, Number.isFinite(scale) ? scale : 1)
      const pos = { x: rp.x / s, y: rp.y / s }
      const dims = layerDimensionsRef.current.get(selectedLayerId)
      if (!dims) {
        canvas.style.cursor = ""
        return
      }
      const over =
        pos.x >= dims.x &&
        pos.x <= dims.x + dims.width &&
        pos.y >= dims.y &&
        pos.y <= dims.y + dims.height
      canvas.style.cursor = over ? "move" : ""
    }
    const handlePointerLeave = () => {
      if (!isDraggingRef.current) {
        try {
          canvas.style.cursor = ""
        } catch {}
      }
    }

    canvas.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUpOrCancel)
    window.addEventListener("pointercancel", handlePointerUpOrCancel)
    canvas.addEventListener("pointermove", handleHoverMove)
    canvas.addEventListener("pointerleave", handlePointerLeave)

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUpOrCancel)
      window.removeEventListener("pointercancel", handlePointerUpOrCancel)
      canvas.removeEventListener("pointermove", handleHoverMove)
      canvas.removeEventListener("pointerleave", handlePointerLeave)
      resetDrag()
      try {
        canvas.style.cursor = ""
      } catch {}
    }
  }, [
    canvasRef.current,
    state.canonical.activeTool.tool,
    state.canonical.layers.byId,
    selectedLayerId,
    layerDimensionsRef.current,
    canvasDimensions.width,
    canvasDimensions.height,
    updateLayer,
    history,
    drawRef.current,
    getRelativePointer,
    resetDrag,
    setIsElementDragging,
    scale,
  ])
}

// Simple Move controls: X/Y inputs updating dimensions.x/y while preserving width/height
export function MoveControls({
  value,
  dispatch,
}: {
  value: { width: number; height: number; x: number; y: number }
  dispatch: (action: any) => void
}) {
  const [x, setX] = useState<number>(value?.x ?? 0)
  const [y, setY] = useState<number>(value?.y ?? 0)

  useEffect(() => {
    setX(Number(value?.x ?? 0))
    setY(Number(value?.y ?? 0))
  }, [value?.x, value?.y])

  const handleXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextX = Number(e.target.value) || 0
    setX(nextX)
    dispatch({
      type: "dimensions",
      payload: {
        width: Number(value?.width ?? 0),
        height: Number(value?.height ?? 0),
        x: nextX,
        y: y,
      },
      t: 0,
    })
  }

  const handleYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextY = Number(e.target.value) || 0
    setY(nextY)
    dispatch({
      type: "dimensions",
      payload: {
        width: Number(value?.width ?? 0),
        height: Number(value?.height ?? 0),
        x: x,
        y: nextY,
      },
      t: 0,
    })
  }

  return (
    <div className='flex items-center gap-3 mt-4'>
      <div className='flex items-center gap-2'>
        <span className='text-sm text-muted-foreground'>X</span>
        <input
          type='number'
          className='w-20 h-8 rounded-sm border border-input bg-background px-2 text-sm'
          value={x}
          onChange={handleXChange}
        />
      </div>
      <div className='flex items-center gap-2'>
        <span className='text-sm text-muted-foreground'>Y</span>
        <input
          type='number'
          className='w-20 h-8 rounded-sm border border-input bg-background px-2 text-sm'
          value={y}
          onChange={handleYChange}
        />
      </div>
      <span className='text-xs text-muted-foreground'>px</span>
    </div>
  )
}
