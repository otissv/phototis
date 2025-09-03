"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { motion, useMotionValue, useTransform } from "motion/react"
import { useDebounce } from "use-debounce"

import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import { initialToolsState } from "@/lib/tools/tools-state"
import type { EditorLayer, CanvasPosition } from "@/lib/editor/state"
import { useEditorContext } from "@/lib/editor/context"
import { ShaderManager } from "@/lib/shaders"
import { HybridRenderer } from "@/lib/shaders/hybrid-renderer"
import { useWorkerRenderer } from "@/lib/hooks/useWorkerRenderer"
import { TaskPriority } from "@/lib/workers/worker-manager"
import { CanvasStateManager } from "@/lib/canvas-state-manager"
import { SetViewportCommand } from "@/lib/editor/commands"
import { useCrop } from "./tools/crop.tools"

// Shader manager instance
const shaderManager = new ShaderManager()

export interface LayerDimensions {
  width: number
  height: number
  x: number
  y: number
}
export interface ImageEditorCanvasProps
  extends Omit<React.ComponentProps<"canvas">, "onProgress"> {
  onProgress?: (progress: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  onDrawReady?: (draw: () => void) => void
  onImageDrop?: (file: File) => void
  renderType?: "worker" | "hybrid" | "default"
}

export interface ViewportState {
  x: number
  y: number
  scale: number
}

export function ImageEditorCanvas({
  onProgress,
  canvasRef,
  onDrawReady,
  onImageDrop,
  renderType,
  ...props
}: ImageEditorCanvasProps) {
  const { history } = useEditorContext()
  const {
    getOrderedLayers,
    getSelectedLayerId,
    state,
    updateLayer,
    dimensionsDocument,
  } = useEditorContext()
  const selectedLayerId = getSelectedLayerId() || "layer-1"
  const isDragActive = state.ephemeral.interaction.isDragging
  const glRef = React.useRef<WebGL2RenderingContext | null>(null)
  const programRef = React.useRef<WebGLProgram | null>(null)
  const textureRef = React.useRef<WebGLTexture | null>(null)
  const positionBufferRef = React.useRef<WebGLBuffer | null>(null)
  const texCoordBufferRef = React.useRef<WebGLBuffer | null>(null)
  const hybridRendererRef = React.useRef<HybridRenderer | null>(null)
  const [processing, setProcessing] = React.useState(0)
  const [isElementDragging, setIsElementDragging] = React.useState(false)

  const canonicalLayers = React.useMemo(
    () => getOrderedLayers(),
    [getOrderedLayers]
  )

  // Worker-based rendering system
  // Memoize worker config so hook callbacks remain stable across renders
  const workerRendererConfig = React.useMemo(
    () => ({
      enableProgressiveRendering: true,
      progressiveLevels: [0.25, 0.5, 1.0] as number[],
      maxRetries: 3,
      taskTimeout: 30000,
    }),
    []
  )

  const {
    isReady: isWorkerReady,
    isInitializing: isWorkerInitializing,
    isProcessing: isWorkerProcessing,
    progress: workerProgress,
    error: workerError,
    queueStats,
    initialize: initializeWorker,
    ensureCanvasSize,
    resize: resizeWorker,
    renderLayers: renderLayersWithWorker,
    cancelCurrentTask,
    canvasRef: workerCanvasRef,
  } = useWorkerRenderer(workerRendererConfig)

  // Stable refs for worker state to avoid re-render loops in draw
  const isWorkerReadyRef = React.useRef(false)
  const isWorkerProcessingRef = React.useRef(false)
  const isWorkerInitializingRef = React.useRef(false)

  React.useEffect(() => {
    isWorkerReadyRef.current = isWorkerReady
  }, [isWorkerReady])

  React.useEffect(() => {
    isWorkerProcessingRef.current = isWorkerProcessing
  }, [isWorkerProcessing])

  React.useEffect(() => {
    isWorkerInitializingRef.current = isWorkerInitializing
  }, [isWorkerInitializing])

  // Direct image data cache for WebGL textures
  const imageDataCacheRef = React.useRef<Map<string, ImageData>>(new Map())
  const textureCacheRef = React.useRef<Map<string, WebGLTexture>>(new Map())

  // Layer dimensions cache
  const layerDimensionsRef = React.useRef<Map<string, LayerDimensions>>(
    new Map()
  )

  // Canvas dimensions state - mirror canonical.document
  const [canvasDimensions, setCanvasDimensions] = React.useState({
    width: state.canonical.document.width,
    height: state.canonical.document.height,
  })

  // Keep canvas in sync with canonical.document changes
  React.useEffect(() => {
    const width = state.canonical.document.width
    const height = state.canonical.document.height

    if (
      width !== canvasDimensions.width ||
      height !== canvasDimensions.height
    ) {
      setCanvasDimensions({ width, height })

      // If worker owns the canvas, propagate resize so its framebuffer matches
      if (isWorkerReadyRef.current) {
        void resizeWorker(width, height)
      }
      // Trigger redraw when canvas dimensions change since layers are now updated
      // through the standard layer mechanism
      setTimeout(() => drawRef.current?.(), 0)
    }
  }, [
    state.canonical.document.width,
    state.canonical.document.height,
    canvasDimensions.width,
    canvasDimensions.height,
    resizeWorker,
  ])

  // Ensure worker canvas is resized once the worker becomes ready
  React.useEffect(() => {
    if (!isWorkerReady) return
    const width = canvasDimensions.width
    const height = canvasDimensions.height
    void resizeWorker(width, height)
  }, [
    isWorkerReady,
    canvasDimensions.width,
    canvasDimensions.height,
    resizeWorker,
  ])

  // Track canvases we've already initialized to avoid duplicate init
  const initializedCanvasesRef = React.useRef<WeakSet<HTMLCanvasElement>>(
    new WeakSet()
  )
  // Track in-progress initialization to avoid overlapping attempts
  const initializingCanvasesRef = React.useRef<WeakSet<HTMLCanvasElement>>(
    new WeakSet()
  )

  // Initialize worker-based rendering system once per canvas
  React.useEffect(() => {
    const canvas = canvasRef?.current
    if (!canvas) return
    // Skip if already initialized or worker is ready
    if (
      initializedCanvasesRef.current.has(canvas) ||
      initializingCanvasesRef.current.has(canvas) ||
      isWorkerReady ||
      isWorkerInitializing
    ) {
      return
    }
    // If forcing hybrid renderer, skip worker init
    if (renderType === "hybrid") {
      return
    }
    const canvasStateManager = CanvasStateManager.getInstance()
    if (!canvasStateManager.canTransferToOffscreen(canvas)) {
      console.log(
        "🎨 [Renderer] Canvas cannot be transferred to OffscreenCanvas, will use hybrid renderer"
      )
      return
    }
    console.log(
      `🎨 [WORKER] Initializing worker-based renderer at ${Date.now()}`
    )
    initializingCanvasesRef.current.add(canvas)
    void initializeWorker(canvas).then((success) => {
      if (success) {
        console.log(
          `🎨 [WORKER] Worker-based renderer initialized successfully at ${Date.now()}`
        )

        initializedCanvasesRef.current.add(canvas)
      } else {
        console.error("🎨 [WORKER] Failed to initialize worker renderer")
      }
      initializingCanvasesRef.current.delete(canvas)
    })
  }, [
    isWorkerReady,
    isWorkerInitializing,
    canvasRef?.current,
    initializeWorker,
    renderType,
  ])

  // Motion values for smooth viewport handling
  const viewportX = useMotionValue(0)
  const viewportY = useMotionValue(0)
  const viewportScale = useMotionValue(1)

  // Current viewport state for calculations
  const [viewport, setViewport] = React.useState<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
  })

  // Get the effective filters for the selected layer (including adjustment layers above it)
  const effectiveFilters = React.useMemo(() => {
    if (!selectedLayerId) return initialToolsState

    const selectedLayer = state.canonical.layers.byId[selectedLayerId]
    if (!selectedLayer) return initialToolsState

    // Start with the selected layer's own filters
    let effects: ImageEditorToolsState = { ...initialToolsState }

    if (selectedLayer.type === "image") {
      const imageLayer = selectedLayer as any
      if (imageLayer.filters) {
        effects = { ...effects, ...imageLayer.filters }
      }
    } else if (selectedLayer.type === "document") {
      // For document layer, apply document-level transformations to all layers
      const documentLayer = selectedLayer as any
      if (documentLayer.filters) {
        effects = { ...effects, ...documentLayer.filters }
      }
    }

    // Apply adjustment layers that are above the selected layer
    const selectedIndex = state.canonical.layers.order.indexOf(selectedLayerId)
    if (selectedIndex >= 0) {
      for (
        let i = selectedIndex + 1;
        i < state.canonical.layers.order.length;
        i++
      ) {
        const layerId = state.canonical.layers.order[i]
        const layer = state.canonical.layers.byId[layerId]

        if (layer?.type === "adjustment" && layer.visible) {
          const adjustment = layer as any
          if (adjustment.parameters) {
            Object.entries(adjustment.parameters).forEach(([key, value]) => {
              if (key in effects) {
                ;(effects as any)[key] = value
              }
            })
          }
        }
      }
    }

    return effects
  }, [
    selectedLayerId,
    state.canonical.layers.order,
    state.canonical.layers.byId,
  ])

  // Use effective filters instead of just selected layer filters
  const [debouncedToolsValues] = useDebounce(effectiveFilters, 100)
  const [throttledToolsValues] = useDebounce(effectiveFilters, 16)

  // Track if we're currently drawing to prevent overlapping draws
  const isDrawingRef = React.useRef(false)

  // Smooth transition state for tool values
  const [smoothToolsValues, setSmoothToolsValues] =
    React.useState<ImageEditorToolsState>(effectiveFilters)
  const animationRef = React.useRef<Map<string, number>>(new Map())

  // Keep latest filters in refs so draw() sees current values without needing to rebind
  const selectedFiltersRef =
    React.useRef<ImageEditorToolsState>(effectiveFilters)
  React.useEffect(() => {
    selectedFiltersRef.current = effectiveFilters
  }, [effectiveFilters])

  const smoothToolsValuesRef =
    React.useRef<ImageEditorToolsState>(smoothToolsValues)
  React.useEffect(() => {
    smoothToolsValuesRef.current = smoothToolsValues
  }, [smoothToolsValues])

  // Animate tool values smoothly when they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: smoothToolsValues cause infinite loop
  React.useEffect(() => {
    const toolKeys = Object.keys(
      effectiveFilters
    ) as (keyof typeof effectiveFilters)[]

    for (const key of toolKeys) {
      if (typeof effectiveFilters[key] === "number") {
        const currentValue = smoothToolsValues[key] as number
        const targetValue = effectiveFilters[key] as number

        if (currentValue !== targetValue) {
          // Cancel any existing animation for this tool
          const existingAnimation = animationRef.current.get(key)
          if (existingAnimation) {
            cancelAnimationFrame(existingAnimation)
          }

          // Do not animate rotation to avoid tweening when selecting rotated layers
          if (key === "rotate") {
            setSmoothToolsValues((prev) => ({
              ...prev,
              [key]: targetValue,
            }))
            animationRef.current.delete(key)
            continue
          }

          // Start smooth animation for other numeric tools
          const startTime = performance.now()
          const duration = 300 // 300ms for smooth transition

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Ease out function for smooth deceleration
            const easeOut = 1 - (1 - progress) ** 3

            const newValue =
              currentValue + (targetValue - currentValue) * easeOut

            setSmoothToolsValues((prev) => ({
              ...prev,
              [key]: newValue,
            }))

            if (progress < 1) {
              const animationId = requestAnimationFrame(animate)
              animationRef.current.set(key, animationId)
            } else {
              animationRef.current.delete(key)
            }
          }

          const animationId = requestAnimationFrame(animate)
          animationRef.current.set(key, animationId)
        }
      }
    }
  }, [effectiveFilters])

  // Force redraw on flip/rotate changes (these are instant toggles and should reflect immediately)
  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to react to orientation tools here
  React.useEffect(() => {
    // Avoid spamming draws during drags; draw loop already handles that case
    if (isDragActive) return
    const timer = setTimeout(() => {
      drawRef.current?.()
    }, 0)
    return () => clearTimeout(timer)
  }, [
    effectiveFilters.flipHorizontal,
    effectiveFilters.flipVertical,
    effectiveFilters.rotate,
    state.canonical.viewport.rotation,
    isDragActive,
  ])

  // Redraw when debounced tool values change (includes adjustment parameters)
  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to react to debounced tools here
  React.useEffect(() => {
    if (isDragActive) return
    const timer = setTimeout(() => {
      drawRef.current?.()
    }, 0)
    return () => clearTimeout(timer)
  }, [debouncedToolsValues, isDragActive])

  // Cleanup animations on unmount
  React.useEffect(() => {
    return () => {
      animationRef.current.forEach((animationId) => {
        cancelAnimationFrame(animationId)
      })
      animationRef.current.clear()
    }
  }, [])

  // Cleanup hybrid renderer on unmount
  React.useEffect(() => {
    return () => {
      if (hybridRendererRef.current) {
        hybridRendererRef.current.cleanup()
        hybridRendererRef.current = null
      }
    }
  }, [])

  // Transform values for smooth viewport updates
  const transformX = useTransform(viewportX, (x) => `${x}px`)
  const transformY = useTransform(viewportY, (y) => `${y}px`)
  const transformScale = useTransform(viewportScale, (scale) => scale)
  // Viewport rotation from canonical state (degrees)
  const viewportRotation = state.canonical.viewport.rotation ?? 0

  // Container ref for viewport calculations
  const containerRef = React.useRef<HTMLDivElement>(null)
  const overlayRef = React.useRef<HTMLCanvasElement>(null)

  // Crop tool interaction state (canvas-space pixel coords)
  const [cropRect, setCropRect] = React.useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const cropDragRef = React.useRef<{
    mode: "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null
    startX: number
    startY: number
    startRect: { x: number; y: number; width: number; height: number }
  } | null>(null)

  // Create a compact signature representing layers order and relevant props
  const layersSignature = React.useMemo(() => {
    return canonicalLayers
      .map((l) => {
        let imageSig = "img:0"
        let adjSig = ""
        if (l.type === "image") {
          const imageLayer = l as any
          if (imageLayer.image) {
            imageSig = `img:${(imageLayer.image as File).name}:${(imageLayer.image as File).size}:$${
              (imageLayer.image as File).type
            }`
          }
        } else if ((l as any).type === "adjustment") {
          const params = ((l as any).parameters || {}) as Record<string, number>
          const keys = Object.keys(params).sort()
          adjSig = `adj:${keys.map((k) => `${k}:${params[k]}`).join("|")}`
        }
        // Include orientation signature so flips/rotation changes trigger redraws
        let orientSig = "orient:0:0:0"
        try {
          const f: any = (l as any).filters || {}
          const fh = f.flipHorizontal ? 1 : 0
          const fv = f.flipVertical ? 1 : 0
          const rot = typeof f.rotate === "number" ? Math.round(f.rotate) : 0
          orientSig = `orient:${fh}:${fv}:${rot}`
        } catch {}
        return [
          l.id,
          l.visible ? 1 : 0,
          l.locked ? 1 : 0,
          l.opacity,
          l.blendMode,
          imageSig,
          adjSig,
          orientSig,
        ].join(":")
      })
      .join("|")
  }, [canonicalLayers])

  // Update WebGL viewport when canvas dimensions change
  React.useEffect(() => {
    const gl = glRef.current
    const canvas = canvasRef?.current

    if (gl && canvas) {
      // Update canvas size
      canvas.width = canvasDimensions.width
      canvas.height = canvasDimensions.height

      // Update WebGL viewport
      gl.viewport(0, 0, canvasDimensions.width, canvasDimensions.height)
    }
  }, [canvasDimensions.width, canvasDimensions.height, canvasRef?.current])

  // Helper function to load image data from various sources (Blob/File or string URL)
  const loadImageDataFromFile = React.useCallback(
    async (source: File | Blob | string): Promise<ImageData | null> => {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(null)
          return
        }

        const loadFromUrl = (url: string) => {
          const img = new Image()
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, img.width, img.height)
            try {
              if (url.startsWith("blob:")) URL.revokeObjectURL(url)
            } catch {}
            resolve(imageData)
          }
          img.onerror = () => {
            try {
              if (url.startsWith("blob:")) URL.revokeObjectURL(url)
            } catch {}
            resolve(null)
          }
          img.src = url
        }

        const loadWithBitmap = async (blob: Blob) => {
          try {
            const bitmap = await createImageBitmap(blob, {
              imageOrientation: "from-image",
            })
            canvas.width = bitmap.width
            canvas.height = bitmap.height
            ctx.drawImage(bitmap, 0, 0)
            if (typeof (bitmap as any).close === "function") {
              try {
                ;(bitmap as any).close()
              } catch {}
            }
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            )
            resolve(imageData)
          } catch {
            // Fallback to <img> pipeline
            const url = URL.createObjectURL(blob)
            loadFromUrl(url)
          }
        }

        try {
          // Blob/File path
          if (typeof Blob !== "undefined" && source instanceof Blob) {
            void loadWithBitmap(source)
            return
          }
          // URL/path string
          if (typeof source === "string") {
            loadFromUrl(source)
            return
          }
        } catch {}
        // Unsupported type
        resolve(null)
      })
    },
    []
  )

  // Remove main image prop loading. Background handled via layer loading below

  // Initialize hybrid renderer when WebGL context is ready
  React.useEffect(() => {
    if (!canvasRef?.current || !glRef.current) {
      return
    }

    const gl = glRef.current

    // Use canvas dimensions instead of canvas element size
    const width = canvasDimensions.width
    const height = canvasDimensions.height

    if (!hybridRendererRef.current) {
      hybridRendererRef.current = new HybridRenderer()
    }

    const success = hybridRendererRef.current.initialize({
      gl,
      width,
      height,
    })

    if (!success) {
      console.error("Failed to initialize hybrid renderer")
      // Reset the hybrid renderer reference so we can try again
      hybridRendererRef.current = null
    }
  }, [canvasRef?.current, canvasDimensions.width, canvasDimensions.height])

  // Handle layer-specific image data loading
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadImageDataFromFile cause infinite loop
  React.useEffect(() => {
    // Prevent updates during drag operations
    if (isDragActive) return

    const loadLayerImages = async () => {
      // Clean up old data
      const currentLayerIds = new Set(
        canonicalLayers.map((layer: EditorLayer) => layer.id)
      )
      const oldData = new Map(imageDataCacheRef.current)

      for (const [layerId, _imageData] of oldData) {
        if (!currentLayerIds.has(layerId) && layerId !== "main") {
          imageDataCacheRef.current.delete(layerId)
          const gl = glRef.current
          const tex = textureCacheRef.current.get(layerId)
          if (gl && tex) {
            gl.deleteTexture(tex)
          }
          textureCacheRef.current.delete(layerId)
        }
      }

      // Load new layer images (including background layer-1)
      for (const layer of canonicalLayers) {
        if (
          layer.type === "image" &&
          (layer as any).image &&
          !imageDataCacheRef.current.has(layer.id)
        ) {
          const imageData = await loadImageDataFromFile((layer as any).image)
          if (imageData) {
            imageDataCacheRef.current.set(layer.id, imageData)

            const currentCanvasWidth = canvasDimensions.width
            const currentCanvasHeight = canvasDimensions.height

            let layerX = 0
            let layerY = 0

            // Center non-background layers
            if (layer.id !== "layer-1") {
              // Calculate center position, ensuring layers stay within canvas bounds
              const maxX = Math.max(0, currentCanvasWidth - imageData.width)
              const maxY = Math.max(0, currentCanvasHeight - imageData.height)

              // Center the layer, but clamp to canvas bounds
              layerX = Math.max(
                0,
                Math.min(maxX, (currentCanvasWidth - imageData.width) / 2)
              )
              layerY = Math.max(
                0,
                Math.min(maxY, (currentCanvasHeight - imageData.height) / 2)
              )

              // Ensure layers are always visible by keeping them within canvas bounds
              if (imageData.width > currentCanvasWidth) {
                // If layer is larger than canvas, center it
                layerX = (currentCanvasWidth - imageData.width) / 2
                layerY = (currentCanvasHeight - imageData.height) / 2
              }
            } else {
              // For background, set canvas size if not yet initialized
              // When image is first loaded, update document size to image dimensions
              try {
                if (
                  state.canonical.document.width === 800 &&
                  state.canonical.document.height === 600
                ) {
                  dimensionsDocument?.({
                    width: imageData.width,
                    height: imageData.height,
                    canvasPosition:
                      state.canonical.document.canvasPosition || "centerCenter",
                  })
                }
              } catch {}
            }

            const dimensions: LayerDimensions = {
              width: imageData.width,
              height: imageData.height,
              x: layerX,
              y: layerY,
            }

            layerDimensionsRef.current.set(layer.id, dimensions)
          }
        }
      }

      // After images and dimensions are prepared, trigger a draw once
      const hasWebGLReady =
        !!glRef.current &&
        !!programRef.current &&
        !!positionBufferRef.current &&
        !!texCoordBufferRef.current &&
        !!textureRef.current

      if (isWorkerReadyRef.current || hasWebGLReady) {
        // Defer to next tick to ensure refs/maps are fully updated
        setTimeout(() => {
          drawRef.current?.()
        }, 0)
      }
    }

    loadLayerImages()
  }, [
    canonicalLayers,
    canvasDimensions.width,
    canvasDimensions.height,
    isDragActive,
  ])

  // Handle viewport updates based on zoom
  React.useEffect(() => {
    const zoom = effectiveFilters.zoom / 100
    viewportScale.set(zoom)
    setViewport((prev) => ({ ...prev, scale: zoom }))
  }, [effectiveFilters.zoom, viewportScale])

  // Center viewport when canvas dimensions change (default)
  React.useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const currentScale = viewportScale.get()

    const centerX =
      (containerRect.width - canvasDimensions.width * currentScale) / 2
    const centerY =
      (containerRect.height - canvasDimensions.height * currentScale) / 2

    viewportX.set(centerX)
    viewportY.set(centerY)

    setViewport((prev) => ({
      ...prev,
      x: centerX,
      y: centerY,
    }))
  }, [
    canvasDimensions.width,
    canvasDimensions.height,
    viewportScale,
    viewportX,
    viewportY,
  ])

  // Document dimensions are now handled directly in the dimensions-canvas.tools.tsx
  // No need for custom event listeners - layer positions are updated through the
  // standard layer update mechanism when dimensions change

  // Previous canvas size tracking removed - no longer needed with direct layer updates

  // Create a ref to access current canonical state to avoid dependency issues
  const canonicalStateRef = React.useRef(state.canonical)
  React.useEffect(() => {
    canonicalStateRef.current = state.canonical
  }, [state.canonical])

  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const currentScale = viewportScale.get()
      const newScale = Math.max(0.1, Math.min(5, currentScale * delta))

      // Zoom towards mouse position
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const currentX = viewportX.get()
      const currentY = viewportY.get()
      const scaleRatio = newScale / currentScale
      const newX = mouseX - (mouseX - currentX) * scaleRatio
      const newY = mouseY - (mouseY - currentY) * scaleRatio

      // Smoothly animate to new values
      viewportX.set(newX)
      viewportY.set(newY)
      viewportScale.set(newScale)

      setViewport({ x: newX, y: newY, scale: newScale })
    },
    [viewportX, viewportY, viewportScale]
  )

  // Double-click to reset viewport
  const handleDoubleClick = React.useCallback(() => {
    // Function to reset viewport with smooth animation
    viewportX.set(0)
    viewportY.set(0)
    viewportScale.set(1)

    setViewport({
      x: 0,
      y: 0,
      scale: 1,
    })
  }, [viewportX, viewportY, viewportScale])

  // Initialize WebGL context and shaders
  React.useEffect(() => {
    if (!canvasRef?.current) return

    const canvas = canvasRef.current
    const canvasStateManager = CanvasStateManager.getInstance()

    // If the worker is initializing or the canvas can still be transferred,
    // defer creating a WebGL context to avoid blocking OffscreenCanvas transfer.
    if (
      renderType !== "hybrid" &&
      !isWorkerReady &&
      (isWorkerInitializing ||
        canvasStateManager.canTransferToOffscreen(canvas))
    ) {
      console.log(
        "🎨 [Renderer] Deferring WebGL context creation while worker initializes/transfer is possible"
      )
      return
    }

    // If forcing worker-only mode and worker isn't ready yet, do not create WebGL
    if (renderType === "worker" && !isWorkerReady) {
      return
    }

    // Check if canvas can be used for WebGL operations
    if (!canvasStateManager.canUseForWebGL(canvas)) {
      const error = canvasStateManager.getErrorMessage(canvas)
      console.warn(
        "Canvas cannot be used for WebGL operations:",
        error || "Canvas has been transferred to OffscreenCanvas"
      )
      return
    }

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: false,
    })
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }
    glRef.current = gl

    // Centralized orientation: flip at unpack time
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    // Initialize Shader Manager
    if (!shaderManager.initialize(gl)) {
      console.error("Failed to initialize shader manager")
      return
    }

    const program = shaderManager.getProgram()
    if (!program) {
      console.error("Failed to get shader program")
      return
    }
    programRef.current = program

    // Buffer Creation and Setup
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    positionBufferRef.current = positionBuffer

    const texCoordBuffer = gl.createBuffer()
    if (!texCoordBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    texCoordBufferRef.current = texCoordBuffer

    // Texture Creation and Setup
    const texture = gl.createTexture()
    if (!texture) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    textureRef.current = texture

    // Cleanup Function
    return () => {
      if (glRef.current) {
        shaderManager.cleanup()
        if (positionBufferRef.current) {
          gl.deleteBuffer(positionBufferRef.current)
          positionBufferRef.current = null
        }
        if (texCoordBufferRef.current) {
          gl.deleteBuffer(texCoordBufferRef.current)
          texCoordBufferRef.current = null
        }
        if (textureRef.current) {
          gl.deleteTexture(textureRef.current)
          textureRef.current = null
        }
        glRef.current = null
      }
    }
  }, [canvasRef?.current, isWorkerReady, isWorkerInitializing, renderType])

  // Helper function to create WebGL texture from ImageData
  const createTextureFromImageData = React.useCallback(
    (imageData: ImageData): WebGLTexture | null => {
      const gl = glRef.current
      if (!gl) return null

      const texture = gl.createTexture()
      if (!texture) return null

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      // Upload image data directly to GPU
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData
      )

      return texture
    },
    []
  )

  // Helper function to load texture for a layer
  const loadLayerTexture = React.useCallback(
    async (layer: EditorLayer): Promise<WebGLTexture | null> => {
      const gl = glRef.current
      if (!gl) return null

      // Check if we already have a cached texture for this layer
      if (textureCacheRef.current.has(layer.id)) {
        return textureCacheRef.current.get(layer.id) || null
      }

      // Adjustment layers don't have textures - they modify other layers
      if (layer.type === "adjustment") {
        return null
      }

      // Group layers don't have textures
      if (layer.type === "group") {
        return null
      }

      // Solid layers don't have textures (they're rendered differently)
      if (layer.type === "solid") {
        return null
      }

      // For image layers, load the actual image texture
      if (layer.type === "image") {
        // Get image data for this layer
        let imageData = imageDataCacheRef.current.get(layer.id)

        // For the background layer (layer-1), use the main image data if available
        if (!imageData && layer.id === "layer-1") {
          imageData = imageDataCacheRef.current.get("main")
        }

        if (imageData) {
          const texture = createTextureFromImageData(imageData)
          if (texture) {
            // Dispose previous texture if any to avoid leaks
            const gl = glRef.current
            const prev = textureCacheRef.current.get(layer.id)
            if (gl && prev && prev !== texture) {
              gl.deleteTexture(prev)
            }
            textureCacheRef.current.set(layer.id, texture)
            return texture
          }
        }

        // For empty layers without image content, return null
        if ((layer as any).isEmpty && !(layer as any).image) {
          return null
        }

        // Fallback to main texture for layers that should have content
        return textureRef.current
      }

      // Fallback to main texture for unknown layer types
      return textureRef.current
    },
    [createTextureFromImageData]
  )

  // Draw function using worker-based rendering for non-blocking GPU operations
  const draw = async () => {
    // Prevent overlapping draws; allow during drags for live preview
    if (isDrawingRef.current) return

    // If worker is initializing, skip fallback/hybrid to avoid noisy warnings and retries
    if (!isWorkerReadyRef.current && isWorkerInitializingRef.current) {
      isDrawingRef.current = false
      return
    }

    // Set drawing flag to prevent overlapping draws
    isDrawingRef.current = true

    // Periodic cleanup of unused cache entries to prevent memory leaks
    try {
      const currentLayerIds = new Set(canonicalLayers.map((l) => l.id))
      currentLayerIds.add("main") // Preserve main image cache

      // Clean up imageData cache
      for (const [key] of Array.from(imageDataCacheRef.current.entries())) {
        if (!currentLayerIds.has(key)) {
          imageDataCacheRef.current.delete(key)
        }
      }

      // Clean up texture cache
      const gl = glRef.current
      for (const [key, tex] of Array.from(textureCacheRef.current.entries())) {
        if (!currentLayerIds.has(key)) {
          if (gl) gl.deleteTexture(tex)
          textureCacheRef.current.delete(key)
        }
      }
    } catch {}

    try {
      // Use worker-based rendering if available (always queue; manager cancels in-flight)

      if (renderType !== "hybrid" && isWorkerReadyRef.current) {
        // Avoid spamming the worker: if a task is already processing, skip
        if (isWorkerProcessingRef.current) {
          isDrawingRef.current = false
          return
        }
        console.log("🎨 [Renderer] Using WORKER-BASED renderer")
        const canvas = canvasRef?.current

        if (!canvas) {
          console.warn("No canvas available for worker rendering")
          isDrawingRef.current = false
          return
        }

        // Get canvas dimensions
        const canvasWidth = canvasDimensions.width
        const canvasHeight = canvasDimensions.height

        // Use throttled values for immediate feedback during dragging
        const activeToolsValues = isDragActive
          ? throttledToolsValues
          : debouncedToolsValues

        // Use smooth values for numbers, but keep flips from latest selected filters (booleans can toggle instantly)
        const renderingToolsValues = {
          ...smoothToolsValuesRef.current,
          flipHorizontal: selectedFiltersRef.current.flipHorizontal,
          flipVertical: selectedFiltersRef.current.flipVertical,
        }

        // If document layer is selected, apply document transformations to all layers
        const isDocumentSelected = selectedLayerId === "document"
        if (isDocumentSelected) {
          // Document transformations should be applied to all layers
          // The hybrid renderer will handle this by applying the same transformations
          // to all layers during rendering
        }

        // Determine priority based on user interaction
        const priority = isDragActive
          ? TaskPriority.CRITICAL
          : TaskPriority.HIGH

        // Ensure worker canvas matches current canvas size before first render
        await ensureCanvasSize(canvasWidth, canvasHeight)

        // Queue render task with worker
        try {
          // Derive per-render dimensions applying dimensions only to active layer

          let dimsForRender = layerDimensionsRef.current
          try {
            const selectedDims = layerDimensionsRef.current.get(selectedLayerId)
            const rz: any = (selectedFiltersRef.current as any)?.dimensions
            if (
              selectedDims &&
              rz &&
              typeof rz.width === "number" &&
              typeof rz.height === "number" &&
              rz.width > 0 &&
              rz.height > 0 &&
              (rz.width !== selectedDims.width ||
                rz.height !== selectedDims.height)
            ) {
              const centeredX = selectedDims.x + selectedDims.width / 2
              const centeredY = selectedDims.y + selectedDims.height / 2
              const newWidth = rz.width
              const newHeight = rz.height
              const newX = Math.round(centeredX - newWidth / 2)
              const newY = Math.round(centeredY - newHeight / 2)
              const clone = new Map(layerDimensionsRef.current)
              clone.set(selectedLayerId, {
                width: newWidth,
                height: newHeight,
                x: newX,
                y: newY,
              })
              dimsForRender = clone
            }
          } catch {}

          const taskId = await renderLayersWithWorker(
            canonicalLayers,
            renderingToolsValues,
            selectedLayerId,
            canvasWidth,
            canvasHeight,
            dimsForRender,
            priority,
            layersSignature
          )

          if (taskId) {
            // Worker is handling the rendering
            console.log(
              "🎨 [Renderer] Worker task queued successfully:",
              taskId
            )
            isDrawingRef.current = false
            return
          }
        } catch (error) {
          console.error("Error queuing render task:", error)
        }
      }

      // If worker-only mode is forced, do not fallback to hybrid
      if (renderType === "worker") {
        isDrawingRef.current = false
        return
      }

      // Fallback to hybrid renderer if worker is not available
      console.log("🎨 [Renderer] Using HYBRID renderer (fallback)")
      const gl = glRef.current
      const canvas = canvasRef?.current

      if (!gl || !canvas) {
        console.warn("🎨 [Renderer] No WebGL context or canvas available")

        isDrawingRef.current = false
        return
      }

      const canvasStateManager = CanvasStateManager.getInstance()

      // Check if canvas can be used for WebGL operations
      if (!canvasStateManager.canUseForWebGL(canvas)) {
        const error = canvasStateManager.getErrorMessage(canvas)
        console.warn(
          "🎨 [Renderer] Canvas cannot be used for hybrid renderer:",
          error || "Canvas has been transferred to OffscreenCanvas"
        )
        isDrawingRef.current = false
        return
      }

      if (!hybridRendererRef.current) {
        console.warn("🎨 [Renderer] Hybrid renderer not initialized")
        isDrawingRef.current = false
        return
      }

      // Get canvas dimensions
      const canvasWidth = canvas.width
      const canvasHeight = canvas.height

      // Pass all layers to the hybrid renderer and let it handle the ordering
      // The hybrid renderer will filter visible layers and sort them properly
      const allLayersToRender = canonicalLayers

      // If no layers are available, just clear the canvas and return
      if (allLayersToRender.length === 0) {
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
      }

      // Use throttled values for immediate feedback during dragging
      const activeToolsValues = isDragActive
        ? throttledToolsValues
        : debouncedToolsValues

      // Use smooth values for numbers, but keep flips from latest selected filters (booleans can toggle instantly)
      const renderingToolsValues = {
        ...smoothToolsValuesRef.current,
        flipHorizontal: selectedFiltersRef.current.flipHorizontal,
        flipVertical: selectedFiltersRef.current.flipVertical,
        rotate: selectedFiltersRef.current.rotate,
      }

      // If document layer is selected, apply document transformations to all layers
      const isDocumentSelected = selectedLayerId === "document"
      if (isDocumentSelected) {
        // Document transformations should be applied to all layers
        // The hybrid renderer will handle this by applying the same transformations
        // to all layers during rendering
      }

      // Create a map of layer textures
      const layerTextures = new Map<string, WebGLTexture>()

      // Load textures for layers that have content (the hybrid renderer will filter visible ones)
      for (const layer of allLayersToRender) {
        if (
          layer.type === "image" &&
          (layer as any).isEmpty &&
          !(layer as any).image
        ) {
          continue
        }

        const layerTexture = await loadLayerTexture(layer)
        if (layerTexture) {
          layerTextures.set(layer.id, layerTexture)
        } else {
          // Fallback to main texture if layer texture fails to load
          if (textureRef.current) {
            layerTextures.set(layer.id, textureRef.current)
          }
        }
      }

      // Use hybrid renderer to render all layers with proper compositing
      if (
        hybridRendererRef.current &&
        allLayersToRender.length > 0 &&
        layerTextures.size > 0
      ) {
        try {
          console.log(
            "🎨 [Renderer] Hybrid renderer executing with",
            allLayersToRender.length,
            "layers"
          )
          // Apply dimensions to active layer in hybrid path too
          let dimsForRender = layerDimensionsRef.current
          try {
            const selectedDims = layerDimensionsRef.current.get(selectedLayerId)

            const rz: any = (selectedFiltersRef.current as any)?.dimensions
            if (
              selectedDims &&
              rz &&
              typeof rz.width === "number" &&
              typeof rz.height === "number" &&
              rz.width > 0 &&
              rz.height > 0 &&
              (rz.width !== selectedDims.width ||
                rz.height !== selectedDims.height)
            ) {
              const centeredX = selectedDims.x + selectedDims.width / 2
              const centeredY = selectedDims.y + selectedDims.height / 2
              const newWidth = rz.width
              const newHeight = rz.height
              const newX = Math.round(centeredX - newWidth / 2)
              const newY = Math.round(centeredY - newHeight / 2)
              const clone = new Map(layerDimensionsRef.current)
              clone.set(selectedLayerId, {
                width: newWidth,
                height: newHeight,
                x: newX,
                y: newY,
              })
              dimsForRender = clone
            }
          } catch {}

          hybridRendererRef.current.renderLayers(
            allLayersToRender,
            layerTextures,
            renderingToolsValues,
            selectedLayerId,
            canvasWidth,
            canvasHeight,
            dimsForRender
          )

          // Render the final result to canvas
          hybridRendererRef.current.renderToCanvas(canvas)
          console.log("🎨 [Renderer] Hybrid renderer completed successfully")
        } catch (error) {
          console.error("🎨 [Renderer] Error in hybrid renderer:", error)
          console.log("🎨 [Renderer] Falling back to simple WebGL rendering")
          // Fallback: Use simple WebGL rendering for the new layer system
          await renderLayersFallback(
            allLayersToRender,
            layerTextures,
            renderingToolsValues,
            canvas
          )
        }
      } else {
        // Fallback: Use simple WebGL rendering for the new layer system
        console.log("🎨 [Renderer] Using simple WebGL fallback renderer")
        await renderLayersFallback(
          allLayersToRender,
          layerTextures,
          renderingToolsValues,
          canvas
        )
      }
    } finally {
      // Always reset the drawing flag
      isDrawingRef.current = false
    }
  }

  // Fallback rendering function for the new layer type system
  const renderLayersFallback = React.useCallback(
    async (
      layers: EditorLayer[],
      layerTextures: Map<string, WebGLTexture>,
      toolsValues: ImageEditorToolsState,
      canvas: HTMLCanvasElement
    ) => {
      const gl = glRef.current
      if (!gl) return

      console.log(
        "🎨 [Renderer] Simple WebGL fallback executing with",
        layers.length,
        "layers"
      )

      // Clear the canvas
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Simple layer rendering: just render image layers in order
      // TODO: Implement proper adjustment layer effects
      for (const layer of layers) {
        if (layer.type === "image" && layer.visible) {
          const texture = layerTextures.get(layer.id)
          if (texture) {
            // Bind the texture
            gl.bindTexture(gl.TEXTURE_2D, texture)

            // Set up the shader program
            const program = programRef.current
            if (program) {
              const setProgram = gl.useProgram.bind(gl)
              setProgram(program)

              // Set uniforms for basic rendering
              const opacityLocation = gl.getUniformLocation(
                program,
                "u_opacity"
              )
              if (opacityLocation) {
                gl.uniform1f(opacityLocation, layer.opacity / 100)
              }

              // Draw the layer
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            }
          }
        }
      }

      console.log("🎨 [Renderer] Simple WebGL fallback completed")
    },
    []
  )

  // Keep a stable reference to the latest draw function (no state update -> no render loop)
  const drawRef = React.useRef<() => void>(() => {})
  // biome-ignore lint/correctness/useExhaustiveDependencies: keep drawRef updated on relevant changes without depending on draw itself
  React.useEffect(() => {
    drawRef.current = draw
  }, [
    layersSignature,
    selectedLayerId,
    isDragActive,
    canvasDimensions.width,
    canvasDimensions.height,
    renderType,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: draw cause infinite loop
  React.useEffect(() => {
    const hasWebGLReady =
      !!glRef.current &&
      !!programRef.current &&
      !!positionBufferRef.current &&
      !!texCoordBufferRef.current &&
      !!textureRef.current

    if (isWorkerReadyRef.current || hasWebGLReady) {
      drawRef.current?.()
    }
  }, [isWorkerReady])

  // biome-ignore lint/correctness/useExhaustiveDependencies: draw cause infinite loop
  React.useEffect(() => {
    onDrawReady?.(() => draw())
  }, [])

  // Redraw when layer properties that affect visibility/compositing change
  React.useEffect(() => {
    if (isDragActive) return
    if (!layersSignature) return
    const timer = setTimeout(() => {
      drawRef.current?.()
    }, 0)
    return () => clearTimeout(timer)
  }, [isDragActive, layersSignature])

  // Force a draw once worker is ready and layers exist (avoid depending on draw to prevent loops)
  React.useEffect(() => {
    if (!isWorkerReady) return
    if (canonicalLayers.length === 0) return
    const timer = setTimeout(() => {
      drawRef.current?.()
    }, 100)
    return () => clearTimeout(timer)
    // Intentionally exclude draw from deps to avoid re-triggering on worker progress/state updates
  }, [isWorkerReady, canonicalLayers.length])

  // Drag and drop handlers
  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (isElementDragging) return
      e.preventDefault()
      e.stopPropagation()
      const canvas = e.currentTarget as HTMLCanvasElement
      canvas.style.border = "2px dashed #3b82f6"
      canvas.style.backgroundColor = "rgba(59, 130, 246, 0.1)"
      document.getElementById("drag-overlay")?.classList.remove("opacity-0")
    },
    [isElementDragging]
  )

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent) => {
      if (isElementDragging) return
      e.preventDefault()
      e.stopPropagation()
      const canvas = e.currentTarget as HTMLCanvasElement
      canvas.style.border = ""
      canvas.style.backgroundColor = ""
      document.getElementById("drag-overlay")?.classList.add("opacity-0")
    },
    [isElementDragging]
  )

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (isElementDragging) return
      e.preventDefault()
      e.stopPropagation()

      // Reset visual feedback
      const canvas = e.currentTarget as HTMLCanvasElement
      canvas.style.border = ""
      canvas.style.backgroundColor = ""
      document.getElementById("drag-overlay")?.classList.add("opacity-0")

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter((file) => file.type.startsWith("image/"))

      if (imageFiles.length > 0 && onImageDrop) {
        onImageDrop(imageFiles[0])
      }
    },
    [onImageDrop, isElementDragging]
  )

  useCrop({
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
  })

  return (
    <div
      ref={containerRef}
      className='relative h-full  flex items-center justify-center '
      role='application'
      aria-label='Image editor canvas container'
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <style>{`
      .image-editor-checkerboard {
        background: repeating-conic-gradient(#fff 0% 25%, #ccc 0% 50%) 0 / 20px 20px;
      }
      
      `}</style>

      <motion.div
        className='relative image-editor-checkerboard'
        style={{
          // x: transformX,
          // y: transformY,
          scale: transformScale,
          rotate: `${viewportRotation}deg`,
          // Keep origin centered so rotation is around canvas center
          transformOrigin: "50% 50%",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: canvasDimensions.width,
            height: canvasDimensions.height,
            backgroundColor: "transparent",
            display: "block",
          }}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          title='Drop image files here to add them as new layers'
          {...props}
          id='image-editor-canvas'
        />
        {/* Preview overlay canvas for tool previews (visible only for crop) */}
        {state.canonical.activeTool.tool === "crop" && (
          <canvas
            className={cn("absolute inset-0 pointer-events-none duration-200")}
            style={{
              width: canvasDimensions.width,
              height: canvasDimensions.height,
            }}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            id='image-editor-overlay'
            ref={overlayRef}
          />
        )}
        {/* Interactive crop overlay */}
        {state.canonical.activeTool.tool === "crop" && cropRect && (
          <div
            className={cn(
              "absolute border border-white/80 outline outline-black/40",
              "bg-transparent"
            )}
            style={{
              left: `${cropRect.x}px`,
              top: `${cropRect.y}px`,
              width: `${cropRect.width}px`,
              height: `${cropRect.height}px`,
              cursor:
                cropDragRef.current?.mode === "move" ? "grabbing" : "move",
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const rect = (
                e.currentTarget.parentElement as HTMLElement
              ).getBoundingClientRect()
              // Determine handle by target dataset
              const target = e.target as HTMLElement
              const handle =
                (target.getAttribute("data-handle") as any) || "move"
              cropDragRef.current = {
                mode: handle,
                startX: e.clientX - rect.left,
                startY: e.clientY - rect.top,
                startRect: { ...cropRect },
              }
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const drag = cropDragRef.current
              if (!drag) return
              const container = e.currentTarget.parentElement as HTMLElement
              const bounds = container.getBoundingClientRect()
              const px = e.clientX - bounds.left
              const py = e.clientY - bounds.top
              const { startX, startY, startRect } = drag
              const mode = drag.mode || "move"
              let nx = startRect.x
              let ny = startRect.y
              let nw = startRect.width
              let nh = startRect.height
              const dx = px - startX
              const dy = py - startY
              const minSize = 8
              const clamp = (v: number, min: number, max: number) =>
                Math.max(min, Math.min(max, v))
              if (mode === "move") {
                nx = clamp(startRect.x + dx, 0, canvasDimensions.width - nw)
                ny = clamp(startRect.y + dy, 0, canvasDimensions.height - nh)
              } else {
                const left = startRect.x
                const top = startRect.y
                const right = startRect.x + startRect.width
                const bottom = startRect.y + startRect.height
                let nleft = left
                let ntop = top
                let nright = right
                let nbottom = bottom
                if (mode.includes("w"))
                  nleft = clamp(left + dx, 0, right - minSize)
                if (mode.includes("e"))
                  nright = clamp(
                    right + dx,
                    left + minSize,
                    canvasDimensions.width
                  )
                if (mode.includes("n"))
                  ntop = clamp(top + dy, 0, bottom - minSize)
                if (mode.includes("s"))
                  nbottom = clamp(
                    bottom + dy,
                    top + minSize,
                    canvasDimensions.height
                  )
                nx = nleft
                ny = ntop
                nw = nright - nleft
                nh = nbottom - ntop
              }
              setCropRect({
                x: Math.round(nx),
                y: Math.round(ny),
                width: Math.round(nw),
                height: Math.round(nh),
              })
              try {
                window.dispatchEvent(
                  new CustomEvent("phototis:crop-rect-changed", {
                    detail: {
                      width: Math.round(nw),
                      height: Math.round(nh),
                    },
                  })
                )
              } catch {}
            }}
            onPointerUp={(e) => {
              cropDragRef.current = null
              ;(e.currentTarget as HTMLElement).releasePointerCapture(
                e.pointerId
              )
            }}
          >
            {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map(
              (h) => (
                <div
                  key={h}
                  data-handle={h}
                  className='absolute bg-white border border-black/40'
                  style={{
                    width: 12,
                    height: 12,
                    left: h.includes("w")
                      ? -4
                      : h.includes("e")
                        ? cropRect.width - 4
                        : cropRect.width / 2 - 4,
                    top: h.includes("n")
                      ? -4
                      : h.includes("s")
                        ? cropRect.height - 4
                        : cropRect.height / 2 - 4,
                    cursor:
                      h === "n" || h === "s"
                        ? "ns-dimensions"
                        : h === "e" || h === "w"
                          ? "ew-dimensions"
                          : h === "ne" || h === "sw"
                            ? "nesw-dimensions"
                            : "nwse-dimensions",
                  }}
                />
              )
            )}
          </div>
        )}
        {/* Drag overlay indicator */}
        {/* <div
          className={cn(
            "absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 transition-opacity duration-200",
            "bg-blue-500/20 border-dashed border-blue-500 backdrop-blur-sm",
            "ring-inset ring-1 ring-blue-500"
          )}
          id='drag-overlay'
          style={{
            width: canvasDimensions.width,
            height: canvasDimensions.height,
          }}
        /> */}
      </motion.div>

      {/* Worker error indicator */}
      {workerError && (
        <div className='absolute inset-0 flex items-center justify-center bg-red-500/20 backdrop-blur-sm'>
          <div className='bg-white/90 rounded-lg p-4 shadow-lg max-w-sm'>
            <div className='text-sm font-medium text-red-600 mb-2'>
              Processing Error
            </div>
            <div className='text-xs text-gray-600'>{workerError}</div>
            <button
              type='button'
              onClick={cancelCurrentTask}
              className='mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600'
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Legacy processing indicator */}
      {processing > 0 && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='text-sm '>Upscaling {processing}%</div>
        </div>
      )}
    </div>
  )
}
