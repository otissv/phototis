"use client"

import React from "react"
import { PlusIcon, MinusIcon, Menu } from "lucide-react"

import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"
import { ImageEditorCanvas } from "@/components/canvas.image-editor"
import { ImageEditorSidebar } from "@/components/sidebar.image-editor"
import { ImageEditorFooter } from "@/components/tools.image-editor"
import type { TOOL_VALUES } from "@/lib/tools/tools"
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
import { EffectsFooter } from "@/components/tools.image-editor"

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
    React.useState<keyof typeof SIDEBAR_TOOLS>("rotate")
  const [selectedTool, setSelectedTool] =
    React.useState<keyof typeof TOOL_VALUES>("brightness")
  const [progress, setProgress] = React.useState(0)

  const {
    getOrderedLayers,
    getSelectedLayer,
    getSelectedLayerId,
    updateLayer,
    selectLayer,
    setZoomPercent,
    state,
    duplicateLayer,
    removeLayer,
    history,
  } = useEditorContext()

  // Get the currently selected layer's filters
  const selectedLayer = React.useMemo(() => {
    return getSelectedLayer() || null
  }, [getSelectedLayer])

  const toolsValues = React.useMemo(() => {
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

  const dispatch = React.useCallback(
    (action: ImageEditorToolsActions) => {
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

  const value = React.useMemo(() => {
    switch (selectedTool) {
      case "rotate":
        return toolsValues.rotate
      case "scale":
        return toolsValues.scale
      case "crop":
        return toolsValues.crop
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
    toolsValues.crop,
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
      // Sync canonical active tool so canvas can react (e.g., crop overlay)
      try {
        history.begin("Set Tool")
        history.push(
          new SetActiveToolCommand({ sidebar: selectedSidebar, tool } as any)
        )
        history.end(true)
      } catch {}
    },
    [history, selectedSidebar]
  )

  const handleSelectedSidebarChange = React.useCallback(
    (sidebar: keyof typeof SIDEBAR_TOOLS) => {
      setSelectedSidebar(sidebar)
      // Sync canonical active tool so canvas can react (e.g., crop overlay)
      try {
        history.begin("Set Tool")
        history.push(
          new SetActiveToolCommand({ sidebar, tool: selectedTool } as any)
        )
        history.end(true)
      } catch {}
    },
    [history, selectedTool]
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
                onSelectedToolChange={handleSelectedToolChange}
                onChange={handleSelectedSidebarChange}
                progress={progress}
                selectedLayer={selectedLayer || ({} as EditorLayer)}
                selectedSidebar={selectedSidebar}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className='hidden lg:block'>
          <ImageEditorSidebar
            onSelectedToolChange={handleSelectedToolChange}
            onChange={handleSelectedSidebarChange}
            progress={progress}
            selectedLayer={selectedLayer || ({} as EditorLayer)}
            selectedSidebar={selectedSidebar}
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
                setSelectedSidebar={setSelectedSidebar}
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
            id='image-editor-canvas'
            canvasRef={canvasRef}
            onDrawReady={handleDrawReady}
          />
        </div>
      </div>

      <ImageEditorFooter
        selectedLayer={selectedLayer || ({} as EditorLayer)}
        selectedSidebar={selectedSidebar}
        dispatch={
          dispatch as (
            value: ImageEditorToolsActions | ImageEditorToolsActions[]
          ) => void
        }
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
          setSelectedSidebar={setSelectedSidebar}
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
