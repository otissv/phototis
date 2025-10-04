"use client"

import { useId, useRef, useState, useCallback, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { motion, useMotionValue, useTransform } from "motion/react"
import { useDebounce } from "use-debounce"

import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import type { EditorLayer } from "@/lib/editor/state"
import { useEditorContext } from "@/lib/editor/context"
import { ShaderManager } from "@/lib/shaders/manager.shader"
import { GlobalShaderRegistryV2 } from "@/lib/shaders/registry.shader"
import { HybridRenderer } from "@/lib/renderer/hybrid.renderer"
import { RenderConfig } from "@/lib/renderer/render-config.renderer"
import { useWorkerRenderer } from "@/components/hooks/useWorkerRenderer"
import { sampleToolsAtTimeMemoized } from "@/lib/animation/sampler"
import {
  TaskPriority,
  WorkerManager,
} from "@/lib/renderer/worker-manager.renderer"
import { CanvasStateManager } from "@/lib/canvas-state-manager"
import { useCrop } from "@/components/tools/crop.tools"
import { useMove } from "@/components/tools/move.tools"
import { config } from "@/config"

export interface LayerDimensions {
  layerId: string
  type: "image" | "document"
  width: number
  height: number
  x: number
  y: number
}

export interface ViewportState {
  x: number
  y: number
  scale: number
}

const { isDebug } = config()

export interface ImageEditorCanvasProps
  extends Omit<React.ComponentProps<"canvas">, "onProgress"> {
  onProgress?: (progress: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  onDrawReady?: (draw: () => void) => void
  onImageDrop?: (file: File) => void
}

export function ImageEditorCanvas({
  onProgress,
  canvasRef,
  onDrawReady,
  onImageDrop,
  ...props
}: ImageEditorCanvasProps) {
  const { history } = useEditorContext()
  const {
    state,
    getOrderedLayers,
    getSelectedLayerId,
    renderType,
    updateLayer,
    updateLayerNonUndoable,
  } = useEditorContext()

  const selectedLayerId = getSelectedLayerId() || "document"
  const isDragActive = state.ephemeral.interaction.isDragging
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const textureRef = useRef<WebGLTexture | null>(null)
  const positionBufferRef = useRef<WebGLBuffer | null>(null)
  const texCoordBufferRef = useRef<WebGLBuffer | null>(null)
  const hybridRendererRef = useRef<HybridRenderer | null>(null)
  const [/*processing*/ /*setProcessing*/ ,] = useState(0)
  const [, setIsElementDragging] = useState(false)
  const id = useId()

  // Helper function to flatten grouped layers for signature calculation
  const flattenLayersForSignature = useCallback(
    (layers: EditorLayer[]): EditorLayer[] => {
      const flattened: EditorLayer[] = []

      for (const layer of layers) {
        if (layer.type === "group") {
          const groupLayer = layer as any

          // Only skip group children if the group itself is not visible
          // collapsed is a UI-only state and should not affect rendering
          if (!groupLayer.visible) {
            continue
          }

          // Add group children in order (they're already in the correct z-order)
          if (Array.isArray(groupLayer.children)) {
            for (const child of groupLayer.children) {
              // Recursively flatten nested groups
              if (child.type === "group") {
                flattened.push(...flattenLayersForSignature([child]))
              } else {
                flattened.push(child)
              }
            }
          }
        } else {
          // Non-group layers are added directly
          flattened.push(layer)
        }
      }

      return flattened
    },
    []
  )

  // Get top-level layers for signature calculation (preserves hierarchical structure)
  const topLevelLayers = useMemo(() => getOrderedLayers(), [getOrderedLayers])

  // Flatten all layers including nested group children for comprehensive change detection
  const canonicalLayers = useMemo(() => {
    return flattenLayersForSignature(topLevelLayers)
  }, [topLevelLayers, flattenLayersForSignature])

  // Worker-based rendering system
  // Memoize worker config so hook callbacks remain stable across renders
  const workerRendererConfig = useMemo(
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
    progress: _workerProgress,
    error: workerError,
    queueStats: _queueStats,
    initialize: initializeWorker,
    ensureCanvasSize,
    resize: resizeWorker,
    renderLayers: renderLayersWithWorker,
    cancelCurrentTask,
    canvasRef: _workerCanvasRef,
  } = useWorkerRenderer(workerRendererConfig)

  // Stable refs for worker state to avoid re-render loops in draw
  const isWorkerReadyRef = useRef(false)
  const isWorkerProcessingRef = useRef(false)
  const isWorkerInitializingRef = useRef(false)

  useEffect(() => {
    isWorkerReadyRef.current = isWorkerReady
  }, [isWorkerReady])

  useEffect(() => {
    isWorkerProcessingRef.current = isWorkerProcessing
  }, [isWorkerProcessing])

  useEffect(() => {
    isWorkerInitializingRef.current = isWorkerInitializing
  }, [isWorkerInitializing])

  // Local guard to prevent double-queuing while we await queueing a worker task
  const isQueueingRenderRef = useRef(false)

  // Centralized draw trigger system
  const drawDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const drawTriggerReasonsRef = useRef<Set<string>>(new Set())

  // Single entry point for all draw triggers
  const triggerDraw = useCallback((reason: string) => {
    drawTriggerReasonsRef.current.add(reason)

    if (drawDebounceTimerRef.current) {
      clearTimeout(drawDebounceTimerRef.current)
    }

    drawDebounceTimerRef.current = setTimeout(() => {
      drawDebounceTimerRef.current = null
      const reasons = Array.from(drawTriggerReasonsRef.current)

      isDebug && console.debug(`🎨 [Draw] Triggered by: ${reasons.join(", ")}`)

      drawTriggerReasonsRef.current.clear()
      drawRef.current?.()
    }, 16) // ~1 frame at 60fps
  }, [])

  // If a draw is requested while the worker is busy, remember to redraw after it finishes
  const pendingRenderRef = useRef<string | null>(null)
  const pendingRenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  // Once the worker is idle again, process any pending render request
  useEffect(() => {
    if (!isWorkerProcessing && pendingRenderRef.current) {
      // Clear and trigger a fresh draw with the latest state
      pendingRenderRef.current = null
      if (pendingRenderTimerRef.current) {
        clearTimeout(pendingRenderTimerRef.current)
        pendingRenderTimerRef.current = null
      }
      triggerDraw("pending-render-flush")
    }
  }, [isWorkerProcessing, triggerDraw])

  // Direct image data cache for WebGL textures
  const imageDataCacheRef = useRef<Map<string, ImageData>>(new Map())
  const textureCacheRef = useRef<Map<string, WebGLTexture>>(new Map())

  // Layer dimensions cache
  const layerDimensionsRef = useRef<Map<string, LayerDimensions>>(new Map())

  // Sync layerDimensionsRef with current layers (including children of groups)
  useEffect(() => {
    // Iterate over the flattened list so grouped children are included
    for (const layer of canonicalLayers) {
      if (layer.type !== "image") continue
      const imageLayer = layer as any
      const filters = imageLayer.filters || {}
      const dimensions = filters.dimensions || {}

      if (dimensions.width && dimensions.height) {
        const layerId = layer.id
        const currentDims = layerDimensionsRef.current.get(layerId)
        const newDims = {
          type: layer.type,
          layerId,
          width: dimensions.width,
          height: dimensions.height,
          x: dimensions.x || 0,
          y: dimensions.y || 0,
        }

        if (
          !currentDims ||
          currentDims.width !== newDims.width ||
          currentDims.height !== newDims.height ||
          currentDims.x !== newDims.x ||
          currentDims.y !== newDims.y
        ) {
          layerDimensionsRef.current.set(layerId, newDims)
        }
      }
    }

    // Remove entries for layers that no longer exist (by flattened ids)
    const currentLayerIds = new Set(canonicalLayers.map((l) => l.id))
    for (const [layerId] of layerDimensionsRef.current) {
      if (!currentLayerIds.has(layerId)) {
        layerDimensionsRef.current.delete(layerId)
      }
    }
  }, [canonicalLayers])

  // Canvas dimensions state - mirror canonical.document
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: state.canonical.document.width,
    height: state.canonical.document.height,
    canvasPosition: state.canonical.document.canvasPosition,
  })

  // Keep canvas in sync with canonical.document changes
  useEffect(() => {
    const width = state.canonical.document.width
    const height = state.canonical.document.height
    const canvasPosition = state.canonical.document.canvasPosition

    if (
      width !== canvasDimensions.width ||
      height !== canvasDimensions.height ||
      canvasPosition !== canvasDimensions.canvasPosition
    ) {
      setCanvasDimensions({ width, height, canvasPosition })

      // If worker owns the canvas, propagate resize so its framebuffer matches
      if (isWorkerReadyRef.current) {
        void resizeWorker(width, height)
      }
      // Trigger redraw when canvas dimensions change since layers are now updated
      // through the standard layer mechanism
      triggerDraw("canvas-resize")
    }
  }, [
    state.canonical.document.width,
    state.canonical.document.height,
    state.canonical.document.canvasPosition,
    canvasDimensions.width,
    canvasDimensions.height,
    canvasDimensions.canvasPosition,
    resizeWorker,
    triggerDraw,
  ])

  // Ensure worker canvas is resized once the worker becomes ready
  useEffect(() => {
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
  const initializedCanvasesRef = useRef<WeakSet<HTMLCanvasElement>>(
    new WeakSet()
  )
  // Track in-progress initialization to avoid overlapping attempts
  const initializingCanvasesRef = useRef<WeakSet<HTMLCanvasElement>>(
    new WeakSet()
  )

  // Initialize worker-based rendering system once per canvas
  useEffect(() => {
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
      isDebug &&
        console.debug(
          "🎨 [Renderer] Canvas cannot be transferred to OffscreenCanvas, will use hybrid renderer"
        )
      return
    }
    initializingCanvasesRef.current.add(canvas)

    if (renderType !== "worker") return

    isDebug &&
      console.debug(
        `🎨 [WORKER] Initializing worker-based renderer at ${Date.now()}`
      )

    void initializeWorker(canvas).then((success) => {
      if (success) {
        isDebug &&
          console.debug(
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
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
  })

  // Get the effective filters for the selected layer (including adjustment layers above it)
  const effectiveFilters = useMemo(() => {
    if (!selectedLayerId) return {} as ImageEditorToolsState

    const selectedLayer = state.canonical.layers.byId[selectedLayerId]
    if (!selectedLayer) return {} as ImageEditorToolsState

    const effects: ImageEditorToolsState = {} as any
    try {
      const canon = require("@/lib/animation/crud") as any
      const base = (selectedLayer as any).filters || {}
      for (const [k, v] of Object.entries(base)) {
        if (canon.isCanonicalTrack(v)) {
          ;(effects as any)[k] = v
        }
      }

      // Apply adjustment layers that are above the selected layer
      const selectedIndex =
        state.canonical.layers.order.indexOf(selectedLayerId)
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
                const baseTrack = (effects as any)[key]
                const track = canon.isCanonicalTrack(baseTrack)
                  ? canon.addOrUpdateKeyframeCanonical(
                      baseTrack,
                      0,
                      value as any
                    )
                  : canon.createCanonicalTrack(key, value as any)
                ;(effects as any)[key] = track
              })
            }
          }
        }
      }
    } catch {
      // fallback: no effects if crud is unavailable
    }

    return effects
  }, [
    selectedLayerId,
    state.canonical.layers.order,
    state.canonical.layers.byId,
  ])

  // Use effective filters instead of just selected layer filters
  const [debouncedToolsValues] = useDebounce(effectiveFilters, 100)

  // Track if we're currently drawing to prevent overlapping draws
  const isDrawingRef = useRef(false)

  // Smooth transition state for tool values
  const [smoothToolsValues, setSmoothToolsValues] =
    useState<any>(effectiveFilters)
  const animationRef = useRef<Map<any, number>>(new Map())

  // Keep latest filters in refs so draw() sees current values without needing to rebind
  const selectedFiltersRef = useRef<ImageEditorToolsState>(effectiveFilters)
  useEffect(() => {
    selectedFiltersRef.current = effectiveFilters
  }, [effectiveFilters])

  const smoothToolsValuesRef = useRef<any>(smoothToolsValues)
  useEffect(() => {
    smoothToolsValuesRef.current = smoothToolsValues
  }, [smoothToolsValues])

  // Animate tool values smoothly when they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: smoothToolsValues cause infinite loop
  useEffect(() => {
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
            setSmoothToolsValues((prev: any) => ({
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

            setSmoothToolsValues((prev: any) => ({
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

  // Force redraw on viewport rotation changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to react to orientation tools here
  useEffect(() => {
    // Avoid spamming draws during drags; draw loop already handles that case
    if (isDragActive) return
    triggerDraw("orientation-tools")
  }, [state.canonical.viewport.rotation, isDragActive, triggerDraw])

  // Redraw when debounced tool values change (includes adjustment parameters)
  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to react to debounced tools here
  useEffect(() => {
    if (isDragActive) return
    triggerDraw("debounced-tools")
  }, [debouncedToolsValues, isDragActive, triggerDraw])

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      animationRef.current.forEach((animationId) => {
        cancelAnimationFrame(animationId)
      })
      animationRef.current.clear()
    }
  }, [])

  // Cleanup hybrid renderer on unmount
  useEffect(() => {
    return () => {
      if (hybridRendererRef.current) {
        hybridRendererRef.current.cleanup()
        hybridRendererRef.current = null
      }
    }
  }, [])

  // Transform values for smooth viewport updates
  const _transformX = useTransform(viewportX, (x) => `${x}px`)
  const _transformY = useTransform(viewportY, (y) => `${y}px`)
  const transformScale = useTransform(viewportScale, (scale) => scale)
  // Viewport rotation from canonical state (degrees)
  const viewportRotation = state.canonical.viewport.rotation ?? 0

  // Container ref for viewport calculations
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  // Crop tool interaction state (canvas-space pixel coords)
  const [cropRect, setCropRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const cropDragRef = useRef<{
    mode: "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null
    startX: number
    startY: number
    startRect: { x: number; y: number; width: number; height: number }
  } | null>(null)

  // Create a comprehensive signature representing all layer operations that should trigger rendering
  const layersSignature = useMemo(() => {
    // Create a signature that covers all layer operations:
    // 1. Top-level layer order (including new layers)
    // 2. Group structure and children order
    // 3. Layer properties (visible, opacity, blend mode)
    // 4. Layer count changes (additions, deletions)
    // 5. Group properties
    // 6. Layer type changes
    const createComprehensiveSignature = (layers: EditorLayer[]): string => {
      // First, create a signature for the top-level order
      const topLevelOrder = layers.map((l) => l.id).join(",")

      // Then create detailed signatures for each layer including group structure
      const layerSignatures = layers.map((l) => {
        let imageSig = "img:0"
        let adjSig = ""
        let groupSig = ""
        let childrenSig = ""

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
        } else if (l.type === "group") {
          const groupLayer = l as any
          // Include group children order and their properties
          if (Array.isArray(groupLayer.children)) {
            const childrenDetails = groupLayer.children
              .map((child: EditorLayer) => {
                return `${child.id}:${child.visible ? 1 : 0}:${child.opacity}:${child.blendMode}`
              })
              .join(",")
            childrenSig = `children:${childrenDetails}`
          }
          groupSig = `group:${childrenSig}`
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
          l.type,
          l.visible ? 1 : 0,
          l.locked ? 1 : 0,
          l.opacity,
          l.blendMode,
          imageSig,
          adjSig,
          groupSig,
          orientSig,
        ].join(":")
      })

      // Combine top-level order with detailed layer signatures
      return `order:${topLevelOrder}|layers:${layerSignatures.join("|")}`
    }

    // Create signature for global layers
    const globalLayersSig = state.canonical.document.globalLayers
      .map((l) =>
        [
          l.id,
          l.type,
          l.visible ? 1 : 0,
          l.locked ? 1 : 0,
          l.opacity,
          l.blendMode,
          l.type === "adjustment"
            ? `adj:${Object.entries(l.parameters || {})
                .map(([k, v]) => `${k}:${v}`)
                .join("|")}`
            : "",
          l.type === "solid" ? `solid:${l.color?.join(",") || ""}` : "",
          l.type === "mask"
            ? `mask:${l.enabled ? 1 : 0}:${l.inverted ? 1 : 0}`
            : "",
        ].join(":")
      )
      .join("|")

    // Create signature for global parameters
    const globalParamsSig = Object.entries(
      state.canonical.document.globalParameters
    )
      .map(([k, v]) => `${k}:${typeof v === "number" ? v : v.value}`)
      .join("|")

    // Use the comprehensive signature that covers all layer operations
    // Use topLevelLayers to preserve hierarchical structure for proper group signature calculation
    const regularLayersSig = createComprehensiveSignature(topLevelLayers)

    return `${regularLayersSig}|globalLayers:${globalLayersSig}|globalParams:${globalParamsSig}`
  }, [
    topLevelLayers,
    state.canonical.document.globalLayers,
    state.canonical.document.globalParameters,
  ])

  // Update WebGL viewport when canvas dimensions change
  useEffect(() => {
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
  const loadImageDataFromFile = useCallback(
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
  useEffect(() => {
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
  useEffect(() => {
    // Prevent updates during drag operations
    if (isDragActive) return

    const loadLayerImages = async () => {
      // Clean up old data
      const currentLayerIds = new Set(
        canonicalLayers.map((layer: EditorLayer) => layer.id)
      )
      const oldData = new Map(imageDataCacheRef.current)

      for (const [layerId, _imageData] of oldData) {
        if (!currentLayerIds.has(layerId)) {
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

              try {
                const canon = require("@/lib/animation/crud") as any
                const prevDims = (layer as any).filters?.dimensions
                const prevCrop = (layer as any).filters?.crop
                const dimsVal = {
                  width: imageData.width,
                  height: imageData.height,
                  x: layerX,
                  y: layerY,
                }
                const cropVal = {
                  x: layerX,
                  y: layerY,
                  width: imageData.width,
                  height: imageData.height,
                  overlay: (prevCrop as any)?.overlay ?? "thirdGrid",
                }
                const dimsTrack = canon.isCanonicalTrack(prevDims)
                  ? canon.addOrUpdateKeyframeCanonical(prevDims, 0, dimsVal)
                  : canon.createCanonicalTrack("dimensions", dimsVal)
                const cropTrack = canon.isCanonicalTrack(prevCrop)
                  ? canon.addOrUpdateKeyframeCanonical(prevCrop, 0, cropVal)
                  : canon.createCanonicalTrack("crop", cropVal)
                updateLayerNonUndoable(layer.id, {
                  filters: {
                    ...layer.filters,
                    dimensions: dimsTrack,
                    crop: cropTrack,
                  },
                } as any)
              } catch {
                updateLayerNonUndoable(layer.id, {
                  filters: {
                    ...layer.filters,
                    dimensions: {
                      ...((layer as any).filters?.dimensions || {}),
                      width: imageData.width,
                      height: imageData.height,
                      x: layerX,
                      y: layerY,
                    },
                    crop: {
                      ...((layer as any).filters?.crop || {}),
                      width: imageData.width,
                      height: imageData.height,
                      x: layerX,
                      y: layerY,
                    },
                  },
                } as any)
              }
            }

            const layerDimensions: LayerDimensions = {
              type: layer.type,
              layerId: layer.id,
              width: imageData.width,
              height: imageData.height,
              x: layerX,
              y: layerY,
            }

            layerDimensionsRef.current.set(layer.id, layerDimensions)
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
        triggerDraw("webgl-ready")
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
  useEffect(() => {
    const zoom = state.canonical.viewport.zoom / 100
    viewportScale.set(zoom)
    setViewport((prev) => ({ ...prev, scale: zoom }))
  }, [viewportScale, state.canonical.viewport.zoom])

  // Center viewport when canvas dimensions change (default)
  useEffect(() => {
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

  // Create a ref to access current canonical state to avoid dependency issues
  const canonicalStateRef = useRef(state.canonical)
  useEffect(() => {
    canonicalStateRef.current = state.canonical
  }, [state.canonical])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Only handle wheel events when Ctrl key is held down
      if (!e.ctrlKey) return

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
  const handleDoubleClick = useCallback(() => {
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
  useEffect(() => {
    if (!canvasRef?.current) return

    const canvas = canvasRef.current
    const canvasStateManager = CanvasStateManager.getInstance()

    // If the worker is initializing or the canvas can still be transferred,
    // defer creating a WebGL context to avoid blocking OffscreenCanvas transfer.
    if (
      renderType === "worker" &&
      !isWorkerReady &&
      (isWorkerInitializing ||
        canvasStateManager.canTransferToOffscreen(canvas))
    ) {
      isDebug &&
        console.debug(
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

    // Configure WebGL with centralized settings
    RenderConfig.configureWebGL(gl)

    // No legacy shader program needed; renderer manages its own programs

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

    const texCoordBuffer = RenderConfig.createCanvasTexCoordBuffer(gl)
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
  const createTextureFromImageData = useCallback(
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
  const loadLayerTexture = useCallback(
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
        const imageData = imageDataCacheRef.current.get(layer.id)

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
        // For empty layers or missing image content, return null (no fallback texture)
        return null
      }

      // Fallback to main texture for unknown layer types
      return textureRef.current
    },
    [createTextureFromImageData]
  )

  // Ensure HybridRenderer is created and initialized (idempotent)
  const ensureHybridInitialized = useCallback((): boolean => {
    const gl = glRef.current
    const canvas = canvasRef?.current
    if (!gl || !canvas) return false
    const width = canvasDimensions.width
    const height = canvasDimensions.height
    if (width <= 0 || height <= 0) return false
    if (!hybridRendererRef.current) {
      hybridRendererRef.current = new HybridRenderer()
      const ok = hybridRendererRef.current.initialize({
        gl,
        width,
        height,
      })
      if (!ok) {
        hybridRendererRef.current = null
        return false
      }
    }
    return true
  }, [canvasRef?.current, canvasDimensions.width, canvasDimensions.height])

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
      // No special preservation keys; caches will be cleaned based on actual layer IDs

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

    // Build layer dimensions from current state
    const dimsForRender = new Map<
      string,
      Omit<LayerDimensions, "type" | "layerId">
    >()

    for (const [id, dimensions] of layerDimensionsRef.current.entries()) {
      if (dimensions.type === "image") {
        if (dimensions.width && dimensions.height) {
          dimsForRender.set(id, {
            width: dimensions.width,
            height: dimensions.height,
            x: dimensions.x || 0,
            y: dimensions.y || 0,
          })
        }
      }
    }

    // Debug: log computed layer dimensions for hybrid path
    try {
      if (renderType === "hybrid") {
        // debug disabled
      }
    } catch {}

    try {
      // Use worker-based rendering if available (always queue; manager cancels in-flight)

      if (renderType === "worker" && isWorkerReadyRef.current) {
        // Synchronize ref with latest state before decision to avoid stale-read races
        isWorkerProcessingRef.current = isWorkerProcessing
        // Avoid spamming the worker: if a task is already processing or we are in the middle of queueing, skip
        const isBusy =
          isWorkerProcessingRef.current || isQueueingRenderRef.current
        if (isBusy) {
          // Remember that a render was requested while busy; draw right after current task finishes
          if (pendingRenderRef.current !== layersSignature) {
            pendingRenderRef.current = layersSignature
          }
          // As a safety, flush a coalesced draw after a short timeout even if still busy
          if (!pendingRenderTimerRef.current) {
            pendingRenderTimerRef.current = setTimeout(() => {
              pendingRenderTimerRef.current = null
              triggerDraw("safety-timeout")
            }, 250)
          }
          isDrawingRef.current = false
          return
        }
        isDebug && console.debug("🎨 [Renderer] Using WORKER-BASED renderer")
        const canvas = canvasRef?.current

        if (!canvas) {
          console.warn("No canvas available for worker rendering")
          isDrawingRef.current = false
          return
        }

        // Get canvas dimensions
        const canvasWidth = canvasDimensions.width
        const canvasHeight = canvasDimensions.height

        // Use smooth values for numbers, but keep flips from latest selected filters (booleans can toggle instantly)
        // Sample tools at current playhead for worker
        const workerToolsValues = sampleToolsAtTimeMemoized(
          selectedFiltersRef.current as any,
          state.canonical.playheadTime
        )
        // Debug: log flips being sent to worker (global/selected)
        try {
          isDebug &&
            console.debug("editor:tools:global", {
              flipH: (workerToolsValues as any).flipHorizontal,
              flipV: (workerToolsValues as any).flipVertical,
              rotate: selectedFiltersRef.current.rotate,
            })
        } catch {}

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

        // Prepare for worker mode: warm shaders
        try {
          const manager = WorkerManager.getShared()
          await manager.prepareWorkerShaders({
            shaderNames: [
              "compositor",
              "copy",
              // Core adjustments (single-pass)
              "adjustments.brightness",
              "adjustments.contrast",
              "adjustments.saturation",
              "adjustments.hue",
              "adjustments.exposure",
              "adjustments.gamma",
              "adjustments.grayscale",
              "adjustments.invert",
              "adjustments.sepia",
              "adjustments.vibrance",
              "adjustments.colorize",
              "adjustments.temperature",
              "adjustments.tint",
              "adjustments.sharpen",
              "adjustments.noise",
              // Multi-pass blur (we'll compile both passes on demand)
              "adjustments.gaussian_blur",
            ],
          })
        } catch {}

        // Call ShaderManager.prepareForMode('worker') to follow handshake
        try {
          const sm2 = new ShaderManager(GlobalShaderRegistryV2)
          sm2.prepareForMode("worker", canonicalLayers)
        } catch {}

        // Queue render task with worker
        try {
          // Mark that we are queueing so parallel calls won't double-queue
          isQueueingRenderRef.current = true
          const taskId = await renderLayersWithWorker(
            canonicalLayers,
            workerToolsValues as any,
            selectedLayerId,
            canvasWidth,
            canvasHeight,
            dimsForRender,
            priority,
            layersSignature,
            false, // interactive
            state.canonical.document.globalLayers,
            state.canonical.document.globalParameters,
            state.canonical.playheadTime
          )

          if (taskId) {
            // Worker is handling the rendering
            isDebug &&
              console.debug(
                "🎨 [Renderer] Worker task queued successfully:",
                taskId
              )
            // Any previously pending draw request has been effectively scheduled
            pendingRenderRef.current = null
            if (pendingRenderTimerRef.current) {
              clearTimeout(pendingRenderTimerRef.current)
              pendingRenderTimerRef.current = null
            }
            isDrawingRef.current = false
            return
          }
        } catch (error) {
          console.error("Error queuing render task:", error)
        } finally {
          // Allow future queueing attempts
          isQueueingRenderRef.current = false
        }
      }

      // If worker-only mode is forced, do not fallback to hybrid
      if (renderType === "worker") {
        isDrawingRef.current = false
        return
      }

      // Use hybrid renderer (either as fallback or primary mode)
      if (renderType === "hybrid") {
        isDebug && console.debug("🎨 [Renderer] Using HYBRID renderer")
      } else {
        isDebug &&
          console.debug("🎨 [Renderer] Using HYBRID renderer (fallback)")
      }
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
        // Attempt on-demand initialization before bailing
        const ok = ensureHybridInitialized()
        if (!ok || !hybridRendererRef.current) {
          try {
            console.warn("🎨 [Renderer] Hybrid renderer not initialized")
            isDebug &&
              console.debug("🎨 [Hybrid][State] gl?", !!gl, "canvas?", !!canvas)
            isDebug &&
              console.debug(
                "🎨 [Hybrid][State] canvas size:",
                canvas?.width,
                "x",
                canvas?.height
              )
            const dimsArray = Array.from(dimsForRender.entries()).map(
              ([layerId, d]) => ({ layerId, ...d })
            )
            isDebug &&
              console.debug(
                "🎨 [Hybrid][Dims] dimsForRender (pre-init):",
                dimsArray
              )
            const cachedDims = Array.from(
              layerDimensionsRef.current.entries()
            ).map(([id, d]) => ({
              id,
              type: d.type,
              width: d.width,
              height: d.height,
              x: d.x,
              y: d.y,
            }))
            isDebug &&
              console.debug(
                "🎨 [Hybrid][Dims] layerDimensionsRef (pre-init):",
                cachedDims
              )
          } catch {}
          isDrawingRef.current = false
          return
        }
      }

      // Get canvas dimensions
      const canvasWidth = canvas.width
      const canvasHeight = canvas.height

      // Pass top-level layers (preserve groups). Renderer will precomp groups
      const allLayersToRender = topLevelLayers.filter(
        (l) => l.visible !== false
      )

      // If no layers are available, just clear the canvas and return
      if (allLayersToRender.length === 0) {
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
      }

      // Sample tools at current playhead for hybrid
      const hybridToolsValues = sampleToolsAtTimeMemoized(
        selectedFiltersRef.current as any,
        state.canonical.playheadTime
      )

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
      // This includes group children which need textures for group precomposition
      const loadTexturesRecursively = async (layers: EditorLayer[]) => {
        for (const layer of layers) {
          if (layer.type === "image") {
            if ((layer as any).isEmpty && !(layer as any).image) {
              continue
            }

            const layerTexture = await loadLayerTexture(layer)
            if (layerTexture) {
              layerTextures.set(layer.id, layerTexture)
            }
          } else if (layer.type === "group") {
            // Recursively load textures for group children
            const groupLayer = layer as any
            if (Array.isArray(groupLayer.children)) {
              await loadTexturesRecursively(groupLayer.children)
            }
          }
        }
      }

      await loadTexturesRecursively(allLayersToRender)

      // Use hybrid renderer to render all layers with proper compositing
      if (
        hybridRendererRef.current &&
        allLayersToRender.length > 0 &&
        layerTextures.size > 0
      ) {
        try {
          isDebug &&
            console.debug(
              "🎨 [Renderer] Hybrid renderer executing with",
              allLayersToRender.length,
              "layers"
            )

          // Debug: log global layers being passed to hybrid renderer
          if (
            state.canonical.document.globalLayers &&
            state.canonical.document.globalLayers.length > 0
          ) {
            console.debug(
              "🎨 [MainThread] Passing global layers to HybridRenderer:",
              state.canonical.document.globalLayers.map((l: any) => ({
                id: l.id,
                type: l.type,
                visible: l.visible,
              }))
            )
          } else {
            console.debug(
              "🎨 [MainThread] No global layers passed to HybridRenderer"
            )
          }

          hybridRendererRef.current.renderLayers(
            allLayersToRender,
            layerTextures,
            hybridToolsValues as any,
            selectedLayerId,
            canvasWidth,
            canvasHeight,
            dimsForRender,
            state.canonical.document.globalLayers,
            state.canonical.document.globalParameters,
            state.canonical.playheadTime
          )

          // Render the final result to canvas
          hybridRendererRef.current.renderToCanvas(canvas)
          isDebug &&
            console.debug(
              "🎨 [Renderer] Hybrid renderer completed successfully"
            )
        } catch (error) {
          console.error("🎨 [Renderer] Error in hybrid renderer:", error)
          isDebug &&
            console.debug(
              "🎨 [Renderer] Falling back to simple WebGL rendering"
            )
          // Fallback: Use simple WebGL rendering for the new layer system
          await renderLayersFallback(allLayersToRender, layerTextures)
        }
      } else {
        // Fallback: Use simple WebGL rendering for the new layer system
        isDebug &&
          console.debug("🎨 [Renderer] Using simple WebGL fallback renderer")
        await renderLayersFallback(allLayersToRender, layerTextures)
      }
    } finally {
      // Always reset the drawing flag
      isDrawingRef.current = false
    }
  }

  // Fallback rendering function for the new layer type system
  const renderLayersFallback = useCallback(
    async (layers: EditorLayer[], layerTextures: Map<string, WebGLTexture>) => {
      const gl = glRef.current
      if (!gl) return

      isDebug &&
        console.debug(
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

      isDebug && console.debug("🎨 [Renderer] Simple WebGL fallback completed")
    },
    []
  )

  // Keep a stable reference to the latest draw function (no state update -> no render loop)
  const drawRef = useRef<() => void>(() => {})
  // biome-ignore lint/correctness/useExhaustiveDependencies: keep drawRef updated on relevant changes without depending on draw itself
  useEffect(() => {
    drawRef.current = draw
  }, [
    layersSignature,
    selectedLayerId,
    isDragActive,
    canvasDimensions.width,
    canvasDimensions.height,
    canvasDimensions.canvasPosition,
    renderType,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: draw cause infinite loop
  useEffect(() => {
    const hasWebGLReady =
      !!glRef.current &&
      !!programRef.current &&
      !!positionBufferRef.current &&
      !!texCoordBufferRef.current &&
      !!textureRef.current

    if (isWorkerReadyRef.current || hasWebGLReady) {
      triggerDraw("worker-ready")
    }
  }, [isWorkerReady, triggerDraw])

  // biome-ignore lint/correctness/useExhaustiveDependencies: draw cause infinite loop
  useEffect(() => {
    onDrawReady?.(() => draw())
  }, [])

  // Redraw when layer properties that affect visibility/compositing change
  useEffect(() => {
    if (isDragActive) return
    if (!layersSignature) return
    triggerDraw("layer-properties")
  }, [isDragActive, layersSignature, triggerDraw])

  // Force a draw once worker is ready and layers exist (avoid depending on draw to prevent loops)
  useEffect(() => {
    if (!isWorkerReady) return
    if (canonicalLayers.length === 0) return
    triggerDraw("worker-ready-with-layers")
    // Intentionally exclude draw from deps to avoid re-triggering on worker progress/state updates
  }, [isWorkerReady, canonicalLayers.length, triggerDraw])

  // Drag and drop handlers
  // drag-over handled by crop/move hooks; keep placeholder if needed later

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

  // Move tool: drag image layers by updating filters.dimensions.x/y
  useMove({
    state,
    selectedLayerId,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement | null>,
    layerDimensionsRef,
    canvasDimensions,
    updateLayer,
    setIsElementDragging,
    drawRef,
    history,
    scale: viewport.scale,
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
          {...props}
          id={`image-editor-canvas-${id}`}
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
            id={`image-editor-overlay-${id}`}
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
                        ? "ns-resize"
                        : h === "e" || h === "w"
                          ? "ew-resize"
                          : h === "ne" || h === "sw"
                            ? "nesw-resize"
                            : "nwse-resize",
                  }}
                />
              )
            )}
          </div>
        )}
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
    </div>
  )
}
