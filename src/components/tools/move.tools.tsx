"use client"

import * as React from "react"

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
  addKeyframe: (
    layerId: string,
    target: "filter" | "adjustment",
    key: string,
    value: any,
    time?: number
  ) => void
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
  addKeyframe,
}: UseMoveArgs) {
  const isDraggingRef = React.useRef(false)
  const dragStartPointerRef = React.useRef<{ x: number; y: number } | null>(
    null
  )
  const dragStartPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const dragLayerSizeRef = React.useRef<{
    width: number
    height: number
  } | null>(null)

  // Create stable refs for the event handlers
  const handlePointerDownRef = React.useRef<(e: PointerEvent) => void>()
  const handlePointerMoveRef = React.useRef<(e: PointerEvent) => void>()
  const handlePointerUpOrCancelRef = React.useRef<(e: PointerEvent) => void>()
  const handleHoverMoveRef = React.useRef<(e: PointerEvent) => void>()
  const handlePointerLeaveRef = React.useRef<() => void>()

  const getRelativePointer = React.useCallback(
    (e: PointerEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    },
    [canvasRef]
  )

  const resetDrag = React.useCallback(() => {
    isDraggingRef.current = false
    dragStartPointerRef.current = null
    dragStartPosRef.current = null
    dragLayerSizeRef.current = null
    setIsElementDragging(false)
  }, [setIsElementDragging])

  // Update the refs with current functions
  React.useEffect(() => {
    handlePointerDownRef.current = (e: PointerEvent) => {
      if (e.button !== 0) return
      const pos = getRelativePointer(e)
      if (!pos) return

      const dims = layerDimensionsRef.current.get(selectedLayerId)
      if (!dims) return

      // Allow dragging if pointer is within layer bounds or if the layer is selected
      // This allows dragging layers that are mostly outside the canvas
      const withinX = pos.x >= dims.x && pos.x <= dims.x + dims.width
      const withinY = pos.y >= dims.y && pos.y <= dims.y + dims.height
      const withinBounds = withinX && withinY

      // If not within bounds, check if we're close enough to the layer (within 200px)
      // This provides a very generous hit area for layers that are far off-screen
      const closeToLayer =
        !withinBounds &&
        pos.x >= dims.x - 200 &&
        pos.x <= dims.x + dims.width + 200 &&
        pos.y >= dims.y - 200 &&
        pos.y <= dims.y + dims.height + 200

      // If the layer is selected, allow dragging from anywhere on the canvas
      // This ensures layers that are completely off-screen can still be dragged
      const isLayerSelected =
        selectedLayerId && state.canonical.layers.byId[selectedLayerId]

      if (!withinBounds && !closeToLayer && !isLayerSelected) return

      const canvas = canvasRef.current
      if (!canvas) return

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

    handlePointerMoveRef.current = (e: PointerEvent) => {
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

      // Allow free movement - layer can be positioned anywhere, including completely off-screen
      const nx = Math.round(startPos.x + dx)
      const ny = Math.round(startPos.y + dy)

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

    handlePointerUpOrCancelRef.current = (e: PointerEvent) => {
      if (!isDraggingRef.current) return

      // Release pointer capture if it was captured
      try {
        const canvas = canvasRef.current
        if (canvas?.hasPointerCapture?.(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId)
        }
      } catch {}

      const dims = layerDimensionsRef.current.get(selectedLayerId)
      if (dims) {
        try {
          const t = state.canonical.timeline.playheadTime || 0
          addKeyframe(
            selectedLayerId,
            "filter",
            "dimensions",
            {
              width: dims.width,
              height: dims.height,
              x: dims.x,
              y: dims.y,
            },
            t
          )
        } catch {}
      }

      resetDrag()
    }

    handleHoverMoveRef.current = (e: PointerEvent) => {
      const canvas = canvasRef.current
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
      // Use the same boundary logic as the drag detection
      const withinX = pos.x >= dims.x && pos.x <= dims.x + dims.width
      const withinY = pos.y >= dims.y && pos.y <= dims.y + dims.height
      const withinBounds = withinX && withinY

      const closeToLayer =
        !withinBounds &&
        pos.x >= dims.x - 200 &&
        pos.x <= dims.x + dims.width + 200 &&
        pos.y >= dims.y - 200 &&
        pos.y <= dims.y + dims.height + 200

      // If the layer is selected, show move cursor anywhere on the canvas
      const isLayerSelected =
        selectedLayerId && state.canonical.layers.byId[selectedLayerId]
      const over = withinBounds || closeToLayer || isLayerSelected
      canvas.style.cursor = over ? "move" : ""
    }

    handlePointerLeaveRef.current = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!isDraggingRef.current) {
        try {
          canvas.style.cursor = ""
        } catch {}
      }
    }
  }, [
    getRelativePointer,
    selectedLayerId,
    layerDimensionsRef,
    setIsElementDragging,
    scale,
    drawRef,
    canvasRef,
    state.canonical.timeline.playheadTime,
    addKeyframe,
    resetDrag,
    state.canonical.layers.byId,
  ])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isMoveTool = state.canonical.activeTool.tool === "move"
    if (!isMoveTool) {
      try {
        canvas.style.cursor = ""
      } catch {}
      return
    }

    const handlePointerDown = (e: PointerEvent) =>
      handlePointerDownRef.current?.(e)
    const handlePointerMove = (e: PointerEvent) =>
      handlePointerMoveRef.current?.(e)
    const handlePointerUpOrCancel = (e: PointerEvent) =>
      handlePointerUpOrCancelRef.current?.(e)
    const handleHoverMove = (e: PointerEvent) => handleHoverMoveRef.current?.(e)
    const handlePointerLeave = () => handlePointerLeaveRef.current?.()

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
  }, [canvasRef, state.canonical.activeTool.tool, resetDrag])
}

// Simple Move controls: X/Y inputs updating dimensions.x/y while preserving width/height
export function MoveControls({
  value,
  dispatch,
}: {
  value: { width: number; height: number; x: number; y: number }
  dispatch: (action: any) => void
}) {
  const [x, setX] = React.useState<number>(value?.x ?? 0)
  const [y, setY] = React.useState<number>(value?.y ?? 0)

  React.useEffect(() => {
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
