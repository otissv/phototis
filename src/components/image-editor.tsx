"use client"

import React from "react"
import { PlusIcon, MinusIcon, Menu } from "lucide-react"

import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import type { SIDEBAR_TOOLS } from "@/lib/state.image-editor"
import { ImageEditorCanvas } from "@/components/canvas.image-editor"
import { ImageEditorSidebar } from "@/components/sidebar.image-editor"
import { getEditorTools } from "@/components/tools.image-editor"
import type { TOOL_VALUES } from "@/lib/tools"
import {
  imageEditorToolsReducer,
  initialState,
  type ImageEditorToolsActions,
} from "@/lib/state.image-editor"

import { EditorProvider, useEditorContext } from "@/lib/editor/context"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { ImageEditorPanels } from "@/components/panels"

export interface ImageEditorProps extends React.ComponentProps<"div"> {
  image: File | null
  onImageDrop?: (file: File) => void
  onDragStateChange?: (isDragging: boolean) => void
  notify?: (props: { message: string; title?: string }) => void
}

function ImageEditorInner({
  image,
  onImageDrop,
  onDragStateChange,
  notify,
  ...props
}: ImageEditorProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawFnRef = React.useRef<() => void>(() => {})

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [isPanelsOpen, setIsPanelsOpen] = React.useState(false)

  const [selectedSidebar, setSelectedSidebar] =
    React.useState<keyof typeof SIDEBAR_TOOLS>("adjust")
  const [selectedTool, setSelectedTool] =
    React.useState<keyof typeof TOOL_VALUES>("brightness")
  const [progress, setProgress] = React.useState(0)

  const {
    getOrderedLayers,
    getSelectedLayer,
    getSelectedLayerId,
    updateLayer,
    selectLayer,
    setBlendMode,
    setZoomPercent,
    state,
    setEphemeral,
    duplicateLayer,
    removeLayer,
    history,
  } = useEditorContext()

  // Get the currently selected layer's filters
  const selectedLayer = React.useMemo(() => {
    return getSelectedLayer() || null
  }, [getSelectedLayer])

  const toolsValues = React.useMemo(() => {
    return selectedLayer?.filters || initialState
  }, [selectedLayer])

  const dispatch = React.useCallback(
    (action: ImageEditorToolsActions) => {
      const current = selectedLayer
      const selectedId = getSelectedLayerId()

      if (!current || !selectedId) return

      const newFilters = Array.isArray(action)
        ? action.reduce((acc, curr) => {
            return imageEditorToolsReducer(acc, curr)
          }, current.filters)
        : imageEditorToolsReducer(current.filters, action)

      updateLayer(selectedId, { filters: newFilters })
    },
    [selectedLayer, getSelectedLayerId, updateLayer]
  )

  const value = React.useMemo(() => {
    switch (selectedTool) {
      case "rotate":
        return toolsValues.rotate
      case "scale":
        return toolsValues.scale
      case "brightness":
        return toolsValues.brightness
      case "contrast":
        return toolsValues.contrast
      case "hue":
        return toolsValues.hue
      case "saturation":
        return toolsValues.saturation
      case "exposure":
        return toolsValues.exposure
      case "temperature":
        return toolsValues.temperature
      case "gamma":
        return toolsValues.gamma
      case "vintage":
        return toolsValues.vintage
      case "blur":
        return toolsValues.blur
      case "invert":
        return toolsValues.invert
      case "sepia":
        return toolsValues.sepia
      case "grayscale":
        return toolsValues.grayscale
      case "sharpen":
        return toolsValues.sharpen
      case "recolor":
        return toolsValues.recolor
      case "vibrance":
        return toolsValues.vibrance
      case "noise":
        return toolsValues.noise
      case "grain":
        return toolsValues.grain
      default:
        return 0
    }
  }, [
    selectedTool,
    toolsValues.rotate,
    toolsValues.scale,
    toolsValues.brightness,
    toolsValues.contrast,
    toolsValues.hue,
    toolsValues.saturation,
    toolsValues.exposure,
    toolsValues.temperature,
    toolsValues.gamma,
    toolsValues.vintage,
    toolsValues.blur,
    toolsValues.invert,
    toolsValues.sepia,
    toolsValues.grayscale,
    toolsValues.sharpen,
    toolsValues.recolor,
    toolsValues.vibrance,
    toolsValues.noise,
    toolsValues.grain,
  ])

  const handleSelectedToolChange = React.useCallback(
    (tool: keyof typeof TOOL_VALUES) => {
      setSelectedTool(tool)
    },
    []
  )

  const handleSelectedSidebarChange = React.useCallback(
    (sidebar: keyof typeof SIDEBAR_TOOLS) => {
      setSelectedSidebar(sidebar)
    },
    []
  )

  const { header: Header, footer: ImageEditorFooter } = React.useMemo(
    () =>
      getEditorTools({
        selectedSidebar,
        canvasRef,
        drawFnRef,
      }),
    [selectedSidebar]
  )

  const handleOnProgress = React.useCallback((progress: number) => {
    setProgress(progress)
  }, [])

  const handleDrawReady = React.useCallback((d: () => void) => {
    drawFnRef.current = d
  }, [])

  const handleImageDrop = React.useCallback(
    (file: File) => {
      // Forward to provider's handler by calling through Canvas (which now handles internally)
      // Kept for API compatibility; no-op here
      onImageDrop?.(file)
    },
    [onImageDrop]
  )

  React.useEffect(() => {
    if (!getSelectedLayerId()) {
      const first = getOrderedLayers()[0]
      if (first) selectLayer(first.id)
    }
  }, [getOrderedLayers, getSelectedLayerId, selectLayer])

  // Keep drag state observable to parent if requested
  React.useEffect(() => {
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

  React.useEffect(() => {
    onDragStateChange?.(state.ephemeral.interaction.isDragging)
  }, [onDragStateChange, state.ephemeral.interaction.isDragging])

  // Global keyboard shortcuts
  // biome-ignore lint/correctness/useExhaustiveDependencies: history methods are stable via internal refs; intentional minimal deps
  React.useEffect(() => {
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

      // Duplicate layer (Photoshop-style: Cmd/Ctrl+J)
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
      className='lg:grid lg:grid-cols-[80px_1fr_auto] lg:grid-rows-[auto_1fr_auto] justify-center gap-x-4 h-full'
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
                selected={selectedSidebar}
                onSelectedToolChange={handleSelectedToolChange}
                onChange={handleSelectedSidebarChange}
                dispatch={dispatch}
                progress={progress}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className='hidden lg:block'>
          <ImageEditorSidebar
            selected={selectedSidebar}
            onSelectedToolChange={handleSelectedToolChange}
            onChange={handleSelectedSidebarChange}
            dispatch={dispatch}
            progress={progress}
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
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className='lg:col-start-2 lg:row-start-1 w-full flex flex-col'>
        <div className='flex flex-col items-center'>
          <Header
            dispatch={dispatch}
            selectedTool={selectedTool}
            onSelectedToolChange={handleSelectedToolChange}
            toolsValues={toolsValues}
            progress={progress}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        </div>
      </div>

      <div className='lg:col-start-2 lg:row-start-1 lg:row-span-2 flex flex-col items-center overflow-auto border rounded-sm h-full'>
        <div className='relative h-full'>
          <ImageEditorCanvas
            onProgress={handleOnProgress}
            id='image-editor-canvas'
            canvasRef={canvasRef}
            onDrawReady={handleDrawReady}
          />
        </div>
      </div>

      <ImageEditorFooter
        image={image}
        dispatch={dispatch}
        selectedTool={selectedTool}
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
        <ImageEditorPanels
          className='lg:row-span-3 w-full'
          defaultValue='layers'
          notify={notify}
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
  const handleZoom = React.useCallback(
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
  image,
  onImageDrop,
  onDragStateChange,
  ...props
}: ImageEditorProps) {
  return (
    <EditorProvider initialImage={image}>
      <ImageEditorInner
        image={image}
        onImageDrop={onImageDrop}
        onDragStateChange={onDragStateChange}
        {...props}
      />
    </EditorProvider>
  )
}
