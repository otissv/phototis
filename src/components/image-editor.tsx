// KF-MIGRATE: All effective filters should come from sampled Tracks; remove reliance on initialToolsState at runtime.
"use client"

import { useId, useRef, useState, useCallback, useMemo, useEffect } from "react"
import { PlusIcon, MinusIcon, Menu } from "lucide-react"

import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import type { SidebarToolsKeys } from "@/lib/tools/tools-state"
import { ImageEditorCanvas } from "@/components/canvas.image-editor"
import { ImageEditorSidebar } from "@/components/sidebar.image-editor"
import { ImageEditorFooter } from "@/components/tools.image-editor"
import {
  imageEditorToolsReducer,
  initialToolsState,
  type ImageEditorToolsActions,
} from "@/lib/tools/tools-state"
import { SetActiveToolCommand } from "@/lib/editor/commands"
import { EditorProvider, useEditorContext } from "@/lib/editor/context"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { ImageEditorPanels } from "@/components/panels"
import type { EditorLayer } from "@/lib/editor/state"
import { WorkerPrewarm } from "./worker-prewarm"
import { getImageDimensions } from "@/lib/utils/get-image-dimensions"
import { config } from "@/config"
import { capitalize } from "@/lib/utils/capitalize"
import { sampleToolsAtTime } from "@/lib/tools/tools-state"
import { TimelinePanel } from "./timeline/timeline-panel"

const { isDebug } = config()

export interface ImageEditorProps extends React.ComponentProps<"div"> {
  images: File[]
  onImageDrop?: (file: File) => void
  onDragStateChange?: (isDragging: boolean) => void
  notify?: (props: { message: string; title?: string }) => void
  allowAddMultipleImages?: boolean
}

function ImageEditorInner({
  images,
  onImageDrop,
  onDragStateChange,
  notify,
  allowAddMultipleImages = false,
  ...props
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawFnRef = useRef<() => void>(() => {})

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPanelsOpen, setIsPanelsOpen] = useState(false)
  const id = useId()

  const [progress, setProgress] = useState(0)

  const {
    state,
    activeTool,
    history,
    duplicateLayer,
    getOrderedLayers,
    getSelectedLayer,
    getSelectedLayerId,
    removeLayer,
    renderType,
    setRenderType,
    selectLayerNonUndoable,
    setZoomPercent,
    updateLayer,
  } = useEditorContext()

  // Get the currently selected layer's filters
  const selectedLayer = useMemo(() => {
    return getSelectedLayer() || null
  }, [getSelectedLayer])

  const toolsValues = useMemo(() => {
    // If document layer is selected, use document filters
    if (selectedLayer?.id === "document" && selectedLayer.type === "document") {
      return (selectedLayer as any).filters || initialToolsState
    }
    // For image layers, use their filters
    if (selectedLayer?.type === "image") {
      return (selectedLayer as any).filters || initialToolsState
    }
    // For other layer types, return initial state
    return initialToolsState
  }, [selectedLayer])

  // Sample tools for immediate UI reads outside footer controls
  const sampledTools = useMemo(() => {
    return sampleToolsAtTime(toolsValues as any, state.canonical.playheadTime)
  }, [toolsValues, state.canonical.playheadTime])

  const dispatch = useCallback(
    (action: ImageEditorToolsActions | ImageEditorToolsActions[]) => {
      const current = selectedLayer
      const selectedId = getSelectedLayerId()

      if (!current || !selectedId) return

      // Only allow filter updates for image and document layers
      if (current.type !== "image" && current.type !== "document") return

      const currentFilters = (current as any).filters || initialToolsState
      const newFilters = Array.isArray(action)
        ? action.reduce((acc, curr) => {
            return imageEditorToolsReducer(acc, curr)
          }, currentFilters)
        : imageEditorToolsReducer(currentFilters, action)

      // Cast to any to bypass type checking for filters property
      updateLayer(selectedId, { filters: newFilters } as any)
    },
    [selectedLayer, getSelectedLayerId, updateLayer]
  )

  const value = useMemo(() => {
    switch (activeTool) {
      case "rotate":
        return sampledTools.rotate
      case "scale":
        return sampledTools.scale
      case "crop":
        return toolsValues.crop
      default:
        return 0
    }
  }, [activeTool, sampledTools.rotate, sampledTools.scale, toolsValues.crop])

  const handleSelectedToolChange = useCallback(
    (tool: SidebarToolsKeys) => {
      try {
        history.begin(`Select ${capitalize(tool)}`)
        history.push(
          new SetActiveToolCommand({ sidebar: activeTool, tool } as any)
        )
        history.end(true)
      } catch {}
    },
    [history, activeTool]
  )

  const handleOnProgress = useCallback((progress: number) => {
    setProgress(progress)
  }, [])

  const handleDrawReady = useCallback((d: () => void) => {
    drawFnRef.current = d
  }, [])

  // Image drop is handled internally by canvas/provider

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("phototis:renderType", renderType)
      }
    } catch {}
  }, [renderType])

  useEffect(() => {
    if (!getSelectedLayerId()) {
      const first = getOrderedLayers()[0]
      if (first) selectLayerNonUndoable(first.id)
    }
  }, [getOrderedLayers, getSelectedLayerId, selectLayerNonUndoable])

  // Keep drag state observable to parent if requested
  useEffect(() => {
    // Provide a thumbnail provider to history to capture tiny previews per step
    const makeThumb = (): string | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      try {
        const w = 64
        const h = Math.max(1, Math.round((canvas.height / canvas.width) * w))
        const off = document.createElement("canvas")
        off.width = w
        off.height = h
        const ctx = off.getContext("2d")
        if (!ctx) return null
        ctx.drawImage(canvas, 0, 0, w, h)
        return off.toDataURL("image/jpeg", 0.5)
      } catch {
        return null
      }
    }
    ;(history as any)?.setThumbnailProvider?.(makeThumb)
    return () => {
      ;(history as any)?.setThumbnailProvider?.(null)
    }
  }, [history])

  useEffect(() => {
    onDragStateChange?.(state.ephemeral.interaction.isDragging)
  }, [onDragStateChange, state.ephemeral.interaction.isDragging])

  // Global keyboard shortcuts
  // biome-ignore lint/correctness/useExhaustiveDependencies: history methods are stable via internal refs; intentional minimal deps
  useEffect(() => {
    const isTextInput = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null
      if (!node) return false
      const tag = node.tagName?.toLowerCase()
      const editable = (node as any).isContentEditable
      return (
        editable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (node.getAttribute && node.getAttribute("role") === "textbox")
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return
      const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)
      const meta = isMac ? e.metaKey : e.ctrlKey
      const shift = e.shiftKey
      const key = e.key

      // Undo / Redo
      if (meta && !shift && (key === "z" || key === "Z")) {
        e.preventDefault()
        history.undo()
        return
      }
      if (
        meta &&
        ((shift && (key === "z" || key === "Z")) || key.toLowerCase() === "y")
      ) {
        e.preventDefault()
        history.redo()
        return
      }

      // Create checkpoint: Ctrl/Cmd+K
      if (meta && key.toLowerCase() === "k") {
        e.preventDefault()
        ;(history as any)?.addCheckpoint?.("Checkpoint")
        return
      }

      // Optional: Clear history/redo with confirm: Ctrl/Cmd+Backspace
      if (meta && key === "Backspace") {
        if (confirm("Clear history and redo?")) {
          e.preventDefault()
          ;(history as any)?.clearHistory?.()
        }
        return
      }

      // Duplicate layer: Cmd/Ctrl+J)
      if (meta && key.toLowerCase() === "j") {
        e.preventDefault()
        const id = getSelectedLayerId()
        if (id) duplicateLayer(id)
        return
      }

      // Delete layer
      if (key === "Delete" || key === "Backspace") {
        const id = getSelectedLayerId()
        if (id) {
          e.preventDefault()
          removeLayer(id)
        }
        return
      }

      // Zoom controls
      if (meta && (key === "=" || key === "+")) {
        e.preventDefault()
        const next = Math.min(800, state.canonical.viewport.zoom + 25)
        setZoomPercent(next)
        return
      }
      if (meta && (key === "-" || key === "_")) {
        e.preventDefault()
        const next = Math.max(13, state.canonical.viewport.zoom - 25)
        setZoomPercent(next)
        return
      }
      if (meta && key === "0") {
        e.preventDefault()
        setZoomPercent(100)
        return
      }
    }

    window.addEventListener("keydown", onKeyDown, { passive: false })
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [getSelectedLayerId, setZoomPercent, state.canonical.viewport.zoom])

  return (
    <div
      {...props}
      className='lg:grid lg:grid-cols-[65px_1fr_auto] lg:grid-rows-[auto_1fr_auto] justify-center h-full'
    >
      <div className='lg:col-start-1 lg:row-start-1 lg:row-end-3 flex'>
        <div className='lg:hidden'>
          <Popover open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='w-8 h-8 rounded-sm'
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className='w-4 h-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(
                "w-fit p-2 rounded-sm lg:hidden",
                "bg-black/50 box-shadow-sm backdrop-blur-sm"
              )}
            >
              <ImageEditorSidebar
                onChange={handleSelectedToolChange}
                progress={progress}
                selectedLayer={selectedLayer || ({} as EditorLayer)}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className='hidden lg:block'>
          <ImageEditorSidebar
            onChange={handleSelectedToolChange}
            progress={progress}
            selectedLayer={selectedLayer || ({} as EditorLayer)}
          />
        </div>

        <div className=' lg:hidden ml-auto'>
          <Popover open={isPanelsOpen} onOpenChange={setIsPanelsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='w-8 h-8 rounded-sm'
                onClick={() => setIsPanelsOpen(!isPanelsOpen)}
              >
                <Menu className='w-4 h-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(
                "w-[320px] p-2 rounded-sm lg:hidden",
                "bg-black/50 box-shadow-sm backdrop-blur-sm"
              )}
            >
              <ImageEditorPanels
                className='lg:row-span-3 w-full'
                defaultValue='layers'
                toolsValues={toolsValues}
                dispatch={dispatch}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div
        className={cn(
          "lg:col-start-2 lg:row-start-1 lg:row-span-2",
          "flex flex-col items-center overflow-auto border custom-scrollbar",
          selectedLayer?.type === "document" && "border-blue-500 border-2"
        )}
      >
        <div className='relative'>
          <ImageEditorCanvas
            onProgress={handleOnProgress}
            id={`image-editor-canvas-${id}`}
            canvasRef={canvasRef}
            onDrawReady={handleDrawReady}
          />
        </div>
      </div>

      <ImageEditorFooter
        selectedLayer={selectedLayer || ({} as EditorLayer)}
        selectedSidebar={activeTool as any}
        dispatch={
          dispatch as (
            value: ImageEditorToolsActions | ImageEditorToolsActions[]
          ) => void
        }
        selectedTool={activeTool as any}
        value={value}
        onSelectedToolChange={handleSelectedToolChange}
        className='lg:col-start-2 lg:row-start-3 mx-auto'
        toolsValues={toolsValues}
        onProgress={handleOnProgress}
        progress={progress}
        canvasRef={canvasRef}
        drawFnRef={drawFnRef}
      />

      <ZoomControls
        className='lg:col-start-1 lg:row-start-3'
        onZoomChange={setZoomPercent}
        value={state.canonical.viewport.zoom}
      />

      <div className='hidden lg:block lg:col-start-3'>
        {/* For debugging renderer modes */}
        {isDebug && (
          <div>
            <span className='px-2 py-1 rounded bg-black/60 text-white'>
              Renderer
            </span>
            <select
              value={renderType}
              onChange={(e) => setRenderType(e.target.value as any)}
              className='px-2 py-1 rounded border bg-white/90 text-black'
              aria-label='Renderer type'
            >
              <option value='default'>Default (auto with fallback)</option>
              <option value='worker'>Worker (Offscreen) preferred</option>
              <option value='hybrid'>Hybrid (main thread)</option>
            </select>
          </div>
        )}
        <ImageEditorPanels
          className='lg:row-span-3 w-full'
          defaultValue='layers'
          notify={notify}
          allowAddMultipleImages={allowAddMultipleImages}
          toolsValues={toolsValues}
          dispatch={
            dispatch as (
              value: ImageEditorToolsActions | ImageEditorToolsActions[]
            ) => void
          }
        />
      </div>
    </div>
  )
}

function ZoomControls({
  className,
  onZoomChange,
  value,
}: {
  className: string
  onZoomChange: (zoom: number) => void
  value: number
}) {
  const handleZoom = useCallback(
    (operator: "plus" | "minus") => () => {
      const payload = operator === "plus" ? value + 25 : value - 25
      if (payload < 13) {
        return
      }

      onZoomChange(payload)
    },
    [value, onZoomChange]
  )

  return (
    <div className={cn("flex items-center ", className)}>
      <Button
        variant='outline'
        onClick={handleZoom("minus")}
        className='text-xs rounded-l-full p-3'
      >
        <MinusIcon className='w-3 h-3' />
      </Button>{" "}
      <div className='text-xs px-3 border-y h-10 flex items-center'>
        {value}%
      </div>{" "}
      <Button
        variant='outline'
        onClick={handleZoom("plus")}
        className='text-xs rounded-r-full p-3'
      >
        <PlusIcon className='w-3 h-3' />
      </Button>
    </div>
  )
}

export function ImageEditor({
  images,
  onImageDrop,
  onDragStateChange,
  ...props
}: ImageEditorProps) {
  const [dimensions, setDimensions] = useState<
    | {
        width: number
        height: number
        name: string
        size: number
      }[]
    | []
  >([])

  useEffect(() => {
    const fetchDimensions = async (image: File) => {
      const { width, height } = await getImageDimensions(image)
      return { size: width * height, width, height, name: image.name }
    }

    const getCanvasDimensions = async (images: File[]) => {
      const imageSizes: {
        size: number
        width: number
        height: number
        name: string
      }[] = []

      for (const image of images) {
        imageSizes.push(await fetchDimensions(image))
      }

      setDimensions((prev) => [...prev, ...imageSizes])
    }

    getCanvasDimensions(images)
  }, [images])

  return dimensions.length > 0 ? (
    <EditorProvider images={images} dimensions={dimensions}>
      <WorkerPrewarm />
      <ImageEditorInner
        images={images}
        onImageDrop={onImageDrop}
        onDragStateChange={onDragStateChange}
        {...props}
      />

      <TimelinePanel />
    </EditorProvider>
  ) : null
}
