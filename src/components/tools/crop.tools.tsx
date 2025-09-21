"use client"

import * as React from "react"
import { CropIcon, ChevronDown } from "lucide-react"

import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { CropToolsType } from "@/lib/tools/tools"
import { Input } from "@/ui/input"
import type { EditorContextValue } from "@/lib/editor/context"
import type { LayerDimensions } from "../canvas.image-editor"
import type { CropFooterProps } from "../tools.image-editor"

function CropButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("crop")}
      isActive={selectedTool === "crop"}
      disabled={progress}
      className='flex items-center gap-2'
    >
      <CropIcon className='w-4 h-4' />
      Crop
    </ImageEditorButton>
  )
}
CropButton.displayName = "CropButton"

function CropControls({
  value,
  dispatch,
}: Omit<CropFooterProps, "onSelectedToolChange">) {
  const [overlay, setOverlay] = React.useState(value.overlay)
  const [width, setWidth] = React.useState(value.width)
  const [height, setHeight] = React.useState(value.height)

  React.useEffect(() => {
    setOverlay(value.overlay)
    setWidth(value.width)
    setHeight(value.height)
  }, [value.overlay, value.width, value.height])

  const handleOverlayGridChange = (next: string) => {
    const overlay = next as CropToolsType["crop"]["overlay"]
    setOverlay(overlay)
    dispatch?.({ type: "crop", payload: { overlay } as any })
    try {
      window.dispatchEvent(
        new CustomEvent("phototis:crop-overlay-changed", {
          detail: { overlay },
        })
      )
    } catch {}
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = Number(e.target.value) || 0
    setWidth(w)
    dispatch?.({ type: "crop", payload: { width: w, overlay } as any })
    try {
      window.dispatchEvent(
        new CustomEvent("phototis:crop-values-changed", {
          detail: { width: w, height },
        })
      )
    } catch {}
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value) || 0
    setHeight(h)
    dispatch?.({ type: "crop", payload: { height: h, overlay } as any })
    try {
      window.dispatchEvent(
        new CustomEvent("phototis:crop-values-changed", {
          detail: { width, height: h },
        })
      )
    } catch {}
  }

  const handleSave = React.useCallback(() => {
    // Notify canvas to commit crop on the selected layer
    const ev = new CustomEvent("phototis:commit-crop")
    window.dispatchEvent(ev)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: dispatch causes infinite loop
  React.useEffect(() => {
    // Sync width/height when overlay rectangle changes on canvas
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as {
          width?: number
          height?: number
        }
        if (!detail) return
        const w = Number(detail.width ?? width)
        const h = Number(detail.height ?? height)
        if (!Number.isNaN(w)) setWidth(w)
        if (!Number.isNaN(h)) setHeight(h)
        dispatch?.({
          type: "crop",
          payload: { width: w, height: h, overlay } as any,
        })
      } catch {}
    }
    window.addEventListener("phototis:crop-rect-changed", handler)
    // Request initial values when controls mount (or tool shown)
    try {
      window.dispatchEvent(new CustomEvent("phototis:request-crop-rect"))
    } catch {}
    return () =>
      window.removeEventListener("phototis:crop-rect-changed", handler)
  }, [width, height])

  return (
    <div className='flex flex-col justify-start gap-6 text-s my-4'>
      <div className='flex items-center gap-2'>
        <Input
          type='number'
          value={width}
          onChange={handleWidthChange}
          className='w-20'
        />
        x
        <Input
          type='number'
          value={height}
          onChange={handleHeightChange}
          className='w-20'
        />
        px
      </div>

      <div className='flex items-center gap-2'>
        <Select defaultValue={overlay} onValueChange={handleOverlayGridChange}>
          <SelectTrigger className='h-8 w-36 rounded-sm flex items-center gap-2'>
            <SelectValue placeholder='Third Grid' />
            <ChevronDown className='h-4 w-4' />
          </SelectTrigger>
          <SelectContent className='rounded-sm'>
            <SelectItem value='thirdGrid'>Third Grid</SelectItem>
            <SelectItem value='grid'>Grid</SelectItem>
            <SelectItem value='goldenRatio'>Golden Ratio</SelectItem>
            {/* <SelectItem value='goldenSpiral'>Golden Spiral</SelectItem> */}
            <SelectItem value='diagonals'>Diagonals</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size='icon'
          className='rounded-sm h-8 w-fit px-4'
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

function useCrop({
  cropRect,
  setCropRect,
  state,
  layerDimensionsRef,
  selectedLayerId,
  canvasDimensions,
  overlayRef,
  selectedFiltersRef,
  imageDataCacheRef,
  glRef,
  textureCacheRef,
  updateLayer,
  drawRef,
  history,
}: {
  cropRect: { x: number; y: number; width: number; height: number } | null
  setCropRect: React.Dispatch<
    React.SetStateAction<{
      x: number
      y: number
      width: number
      height: number
    } | null>
  >
  state: EditorContextValue["state"]
  layerDimensionsRef: React.RefObject<Map<string, LayerDimensions>>
  selectedLayerId: string
  canvasDimensions: { width: number; height: number }
  overlayRef: React.RefObject<HTMLCanvasElement | null>
  selectedFiltersRef: React.RefObject<any>
  imageDataCacheRef: React.RefObject<Map<string, ImageData>>
  glRef: React.RefObject<WebGLRenderingContext | null>
  textureCacheRef: React.RefObject<Map<string, WebGLTexture>>
  updateLayer: (id: string, layer: any) => void
  drawRef: React.RefObject<() => void>
  history: EditorContextValue["history"]
}) {
  // Reset crop rect each time the crop tool is selected (transition into crop)
  const prevToolRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const current = state.canonical.activeTool.tool
    const prev = prevToolRef.current
    if (current === "crop" && prev !== "crop") {
      const dims = layerDimensionsRef.current.get(selectedLayerId)
      if (dims) {
        setCropRect({
          x: Math.max(0, dims.x),
          y: Math.max(0, dims.y),
          width: dims.width,
          height: dims.height,
        })
        try {
          window.dispatchEvent(
            new CustomEvent("phototis:crop-rect-changed", {
              detail: { width: dims.width, height: dims.height },
            })
          )
          setTimeout(() => {
            try {
              window.dispatchEvent(
                new CustomEvent("phototis:crop-rect-changed", {
                  detail: { width: dims.width, height: dims.height },
                })
              )
            } catch {}
          }, 0)
        } catch {}
      } else {
        setCropRect({
          x: 0,
          y: 0,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
        })
        try {
          window.dispatchEvent(
            new CustomEvent("phototis:crop-rect-changed", {
              detail: {
                width: canvasDimensions.width,
                height: canvasDimensions.height,
              },
            })
          )
          setTimeout(() => {
            try {
              window.dispatchEvent(
                new CustomEvent("phototis:crop-rect-changed", {
                  detail: {
                    width: canvasDimensions.width,
                    height: canvasDimensions.height,
                  },
                })
              )
            } catch {}
          }, 0)
        } catch {}
      }
    }
    prevToolRef.current = current
  }, [
    state.canonical.activeTool.tool,
    selectedLayerId,
    canvasDimensions.width,
    canvasDimensions.height,
    layerDimensionsRef.current.get,
    setCropRect,
  ])

  // Draw crop overlay grid on overlay canvas
  React.useEffect(() => {
    const activeTool = state.canonical.activeTool.tool
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (activeTool !== "crop" || !cropRect) return
    // Darken outside crop area
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
    ctx.restore()
    // Draw border
    ctx.save()
    ctx.strokeStyle = "rgba(255,255,255,0.9)"
    ctx.lineWidth = 1
    ctx.strokeRect(
      cropRect.x + 0.5,
      cropRect.y + 0.5,
      cropRect.width - 1,
      cropRect.height - 1
    )

    // Grid overlay types
    const overlayType = (selectedFiltersRef.current as any)?.crop?.overlay
    ctx.strokeStyle = "rgba(255,255,255,0.65)"
    ctx.lineWidth = 1
    const x = cropRect.x
    const y = cropRect.y
    const w = cropRect.width
    const h = cropRect.height
    if (
      overlayType === "thirdGrid" ||
      overlayType === "goldenRatio" ||
      overlayType === "grid"
    ) {
      const thirds = overlayType === "thirdGrid"
      const goldenRatio = overlayType === "goldenRatio"
      const grid = overlayType === "grid"

      if (grid) {
        // grid: 8x8 subdivisions (adjustable in prefs; 8 is a common default)
        const cols = 8
        const rows = 8
        const dx = w / cols
        const dy = h / rows
        for (let i = 1; i < cols; i++) {
          const gx = x + dx * i
          ctx.beginPath()
          ctx.moveTo(gx + 0.5, y)
          ctx.lineTo(gx + 0.5, y + h)
          ctx.stroke()
        }
        for (let j = 1; j < rows; j++) {
          const gy = y + dy * j
          ctx.beginPath()
          ctx.moveTo(x, gy + 0.5)
          ctx.lineTo(x + w, gy + 0.5)
          ctx.stroke()
        }
      } else {
        // Thirds, Golden Grid (phi lines), and Golden Ratio vertical/horizontal lines
        const ratios = thirds
          ? [1 / 3, 2 / 3]
          : goldenRatio
            ? [0.382, 0.618]
            : [1 / 3, 2 / 3]
        for (const r of ratios) {
          const gx = x + w * r
          ctx.beginPath()
          ctx.moveTo(gx + 0.5, y)
          ctx.lineTo(gx + 0.5, y + h)
          ctx.stroke()
        }
        for (const r of ratios) {
          const gy = y + h * r
          ctx.beginPath()
          ctx.moveTo(x, gy + 0.5)
          ctx.lineTo(x + w, gy + 0.5)
          ctx.stroke()
        }
      }
    } else if (overlayType === "goldenSpiral") {
      // Golden Spiral overlay: fit a golden rectangle inside the crop rect, then draw
      // quarter-circle arcs within successive squares (clockwise)
      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.65)"
      ctx.lineWidth = 1

      const PHI = (1 + Math.sqrt(5)) / 2
      // Fit golden rectangle inside crop rect (centered)
      let grw = w
      let grh = w / PHI
      if (grh > h) {
        grh = h
        grw = h * PHI
      }
      const gx0 = x + (w - grw) / 2
      const gy0 = y + (h - grh) / 2

      let rx = gx0
      let ry = gy0
      let rw = grw
      let rh = grh
      let dir = 0 // 0:right,1:down,2:left,3:up
      const minSize = 2
      for (let i = 0; i < 24; i++) {
        if (rw <= minSize || rh <= minSize) break
        // choose square side (shorter dimension)
        const s = Math.min(rw, rh)
        if (s <= minSize) break

        if (dir === 0) {
          // square at left (top-left at rx,ry)
          const cx = rx + s
          const cy = ry + s
          ctx.beginPath()
          ctx.arc(cx, cy, s, Math.PI, 1.5 * Math.PI)
          ctx.stroke()
          rx += s
          rw -= s
        } else if (dir === 1) {
          // square at top (top-left at rx,ry)
          const cx = rx
          const cy = ry + s
          ctx.beginPath()
          ctx.arc(cx, cy, s, 1.5 * Math.PI, 2 * Math.PI)
          ctx.stroke()
          ry += s
          rh -= s
        } else if (dir === 2) {
          // square at right (top-left at rx + rw - s, ry)
          const cx = rx + (rw - s)
          const cy = ry
          ctx.beginPath()
          ctx.arc(cx, cy, s, 0, 0.5 * Math.PI)
          ctx.stroke()
          rw -= s
        } else {
          // square at bottom (top-left at rx + rw - s, ry + rh - s)
          const cx = rx + rw
          const cy = ry + (rh - s)
          ctx.beginPath()
          ctx.arc(cx, cy, s, 0.5 * Math.PI, Math.PI)
          ctx.stroke()
          rh -= s
        }
        dir = (dir + 1) % 4
      }
      ctx.restore()
    } else if (overlayType === "diagonals") {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y + h)
      ctx.moveTo(x + w, y)
      ctx.lineTo(x, y + h)
      ctx.stroke()
    }
    ctx.restore()
  }, [
    state.canonical.activeTool.tool,
    cropRect,
    overlayRef.current,
    selectedFiltersRef.current,
  ])

  // Sync cropRect size from tool inputs (width/height) while preserving center
  React.useEffect(() => {
    if (state.canonical.activeTool.tool !== "crop") return
    if (!cropRect) return
    const c = (selectedFiltersRef.current as any)?.crop
    if (!c) return
    const newW = Number(c.width) || cropRect.width
    const newH = Number(c.height) || cropRect.height
    if (newW === cropRect.width && newH === cropRect.height) return
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v))
    const cx = cropRect.x + cropRect.width / 2
    const cy = cropRect.y + cropRect.height / 2
    const nx = clamp(
      Math.round(cx - newW / 2),
      0,
      Math.max(0, canvasDimensions.width - newW)
    )
    const ny = clamp(
      Math.round(cy - newH / 2),
      0,
      Math.max(0, canvasDimensions.height - newH)
    )
    setCropRect({
      x: nx,
      y: ny,
      width: Math.round(newW),
      height: Math.round(newH),
    })
  }, [
    state.canonical.activeTool.tool,
    cropRect,
    canvasDimensions.width,
    canvasDimensions.height,
    selectedFiltersRef.current,
    setCropRect,
  ])

  // Directly respond to control input events to update overlay immediately
  React.useEffect(() => {
    const handler = (e: Event) => {
      if (state.canonical.activeTool.tool !== "crop") return
      const detail = (e as CustomEvent).detail as {
        width?: number
        height?: number
      }
      if (!detail || !cropRect) return
      const w = Math.max(1, Number(detail.width ?? cropRect.width))
      const h = Math.max(1, Number(detail.height ?? cropRect.height))
      if (w === cropRect.width && h === cropRect.height) return
      const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v))
      const cx = cropRect.x + cropRect.width / 2
      const cy = cropRect.y + cropRect.height / 2
      const nx = clamp(
        Math.round(cx - w / 2),
        0,
        Math.max(0, canvasDimensions.width - w)
      )
      const ny = clamp(
        Math.round(cy - h / 2),
        0,
        Math.max(0, canvasDimensions.height - h)
      )
      setCropRect({ x: nx, y: ny, width: w, height: h })
      try {
        window.dispatchEvent(
          new CustomEvent("phototis:crop-rect-changed", {
            detail: { width: w, height: h },
          })
        )
      } catch {}
    }
    window.addEventListener("phototis:crop-values-changed", handler)
    return () =>
      window.removeEventListener("phototis:crop-values-changed", handler)
  }, [
    state.canonical.activeTool.tool,
    cropRect,
    canvasDimensions.width,
    canvasDimensions.height,
    setCropRect,
  ])

  // Commit crop handler (triggered by UI Save)
  const commitCrop = React.useCallback(async () => {
    if (!cropRect) return

    const imageData = imageDataCacheRef.current.get(selectedLayerId)
    const dims = layerDimensionsRef.current.get(selectedLayerId)

    if (!imageData || !dims) return

    // Map canvas-space crop rect to image pixel coords
    const scaleX = imageData.width / Math.max(1, dims.width)
    const scaleY = imageData.height / Math.max(1, dims.height)
    const cropXImg = Math.round((cropRect.x - dims.x) * scaleX)
    const cropYImg = Math.round((cropRect.y - dims.y) * scaleY)
    const cropWImg = Math.round(cropRect.width * scaleX)
    const cropHImg = Math.round(cropRect.height * scaleY)
    const sx = Math.max(0, Math.min(imageData.width, cropXImg))
    const sy = Math.max(0, Math.min(imageData.height, cropYImg))
    const sw = Math.max(1, Math.min(imageData.width - sx, cropWImg))
    const sh = Math.max(1, Math.min(imageData.height - sy, cropHImg))

    // Draw cropped region to a canvas
    const srcCanvas = document.createElement("canvas")
    srcCanvas.width = imageData.width
    srcCanvas.height = imageData.height

    const sctx = srcCanvas.getContext("2d")
    if (!sctx) return

    sctx.putImageData(imageData, 0, 0)

    const outCanvas = document.createElement("canvas")
    outCanvas.width = sw
    outCanvas.height = sh

    const octx = outCanvas.getContext("2d")
    if (!octx) return

    octx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh)

    await new Promise<void>((resolve) => setTimeout(() => resolve(), 0))
    // Update caches immediately for seamless redraw
    try {
      const newImageData = octx.getImageData(0, 0, sw, sh)

      imageDataCacheRef.current.set(selectedLayerId, newImageData)

      // Update the layer state with new dimensions instead of directly setting the ref
      const newX = Math.max(
        0,
        Math.min(cropRect.x, canvasDimensions.width - sw)
      )
      const newY = Math.max(
        0,
        Math.min(cropRect.y, canvasDimensions.height - sh)
      )

      const currentLayer = state.canonical.layers.byId[selectedLayerId] as any
      const currentFilters = currentLayer?.filters || {}
      const nextFilters = {
        ...currentFilters,
        dimensions: {
          ...(currentFilters.dimensions || {}),
          width: sw,
          height: sh,
          x: newX,
          y: newY,
        },
      }

      // Update the layer state - the sync effect will update the ref
      updateLayer(selectedLayerId, { filters: nextFilters } as any)

      const gl = glRef.current
      const prevTex = textureCacheRef.current.get(selectedLayerId)
      if (gl && prevTex) {
        gl.deleteTexture(prevTex)
      }
      textureCacheRef.current.delete(selectedLayerId)
    } catch {}

    outCanvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], "crop.png", {
        type: blob.type || "image/png",
      })
      // Update selected layer with new image and reset crop tool values
      try {
        const current = state.canonical.layers.byId[selectedLayerId] as any

        const nextFilters = {
          ...(current?.filters || {}),
          crop: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            overlay: (current?.filters?.crop?.overlay ||
              "thirdGrid") as CropToolsType["crop"]["overlay"],
          },
        }
        history.begin("Crop")
        updateLayer(selectedLayerId, { filters: nextFilters } as any)
        // Use image blob as a new file URL and reload via addImageLayer replacement path
        // For now, rely on caches for immediate view; external state can handle persistence
        history.end(true)
        // setCropRect(null)
        // Force redraw after image reload
        setTimeout(() => {
          drawRef.current?.()
        }, 50)
      } catch (e) {
        console.error("Crop commit failed", e)
      }
    }, "image/png")
  }, [
    cropRect,
    selectedLayerId,
    state.canonical.layers.byId,
    updateLayer,
    history,
    canvasDimensions.width,
    canvasDimensions.height,
    drawRef.current,
    glRef.current,
    imageDataCacheRef.current.set,
    imageDataCacheRef.current.get,
    layerDimensionsRef.current.get,
    textureCacheRef.current.get,
    textureCacheRef.current.delete,
  ])

  // Listen for commit event from controls
  React.useEffect(() => {
    const handler = () => void commitCrop()
    window.addEventListener("phototis:commit-crop", handler)
    return () => window.removeEventListener("phototis:commit-crop", handler)
  }, [commitCrop])

  // Re-render overlay when overlay grid option changes (from controls)
  React.useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ov = (e as CustomEvent).detail?.overlay as
          | CropToolsType["crop"]["overlay"]
          | undefined
        if (ov) {
          const layer = state.canonical.layers.byId[selectedLayerId] as any
          const currentFilters = (layer?.filters || {}) as any
          const nextFilters = {
            ...currentFilters,
            crop: {
              ...(currentFilters.crop || {}),
              overlay: ov,
            },
          }
          updateLayer(selectedLayerId, { filters: nextFilters } as any)
        }
      } catch {}
      setCropRect((r) => (r ? { ...r } : r))
    }
    window.addEventListener("phototis:crop-overlay-changed", handler)
    return () =>
      window.removeEventListener("phototis:crop-overlay-changed", handler)
  }, [updateLayer, selectedLayerId, state.canonical.layers.byId, setCropRect])

  // Respond to request-crop-rect from controls to initialize inputs on first open
  React.useEffect(() => {
    const handleRequest = () => {
      if (!cropRect) return
      try {
        window.dispatchEvent(
          new CustomEvent("phototis:crop-rect-changed", {
            detail: { width: cropRect.width, height: cropRect.height },
          })
        )
      } catch {}
    }
    window.addEventListener("phototis:request-crop-rect", handleRequest)
    return () =>
      window.removeEventListener("phototis:request-crop-rect", handleRequest)
  }, [cropRect])
}

export { CropButton, CropControls, useCrop }
