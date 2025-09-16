// React hook for integrating worker-based rendering with canvas
// Provides non-blocking GPU operations using Web Workers and OffscreenCanvas

import React from "react"
import { WorkerManager, TaskPriority } from "@/lib/workers/worker-manager"
import type { EditorLayer } from "@/lib/editor/state"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import { useEditorContext } from "@/lib/editor/context"

// Worker renderer state
interface WorkerRendererState {
  isReady: boolean
  isInitializing: boolean
  isProcessing: boolean
  currentTaskId: string | null
  progress: number
  error: string | null
  queueStats: {
    queued: number
    active: number
    total: number
  }
}

// Worker renderer configuration
interface WorkerRendererConfig {
  enableProgressiveRendering: boolean
  progressiveLevels: number[]
  maxRetries: number
  taskTimeout: number
}

export function useWorkerRenderer(config: Partial<WorkerRendererConfig> = {}) {
  const { renderType } = useEditorContext()
  const [state, setState] = React.useState<WorkerRendererState>({
    isReady: false,
    isInitializing: false,
    isProcessing: false,
    currentTaskId: null,
    progress: 0,
    error: null,
    queueStats: { queued: 0, active: 0, total: 0 },
  })

  const workerManagerRef = React.useRef<WorkerManager | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const eventListenersRef = React.useRef<Map<string, EventListener>>(new Map())
  // Track last known worker canvas size to avoid rendering before resize
  const workerCanvasSizeRef = React.useRef<{
    width: number
    height: number
  } | null>(null)
  // Coalescing of rapid render requests
  const coalesceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const pendingPromiseRef = React.useRef<{
    resolve: (id: string | null) => void
    promise: Promise<string | null>
  } | null>(null)

  // Initialize worker manager with canvas
  const initialize = React.useCallback(
    async (canvas: HTMLCanvasElement): Promise<boolean> => {
      try {
        // Check if already initialized
        if (workerManagerRef.current?.isReady()) {
          return true
        }

        setState((prev) => ({ ...prev, error: null, isInitializing: true }))

        // Create worker manager
        const manager = WorkerManager.getShared({
          maxWorkers: 1,
          maxRetries: config.maxRetries || 3,
          taskTimeout: config.taskTimeout || 30000,
          enableProgressiveRendering: config.enableProgressiveRendering ?? true,
          progressiveLevels: config.progressiveLevels || [0.25, 0.5, 1.0],
        })
        // Prewarm workers before OffscreenCanvas transfer
        await manager.prepare()

        // Initialize with canvas
        const success = await manager.initialize(canvas)

        if (!success) {
          throw new Error("Failed to initialize worker manager")
        }

        workerManagerRef.current = manager
        canvasRef.current = canvas
        // After initialize, record initial size so draws won't race
        workerCanvasSizeRef.current = {
          width: canvas.width,
          height: canvas.height,
        }

        // Set up event listeners
        setupEventListeners()

        setState((prev) => ({
          ...prev,
          isReady: true,
          isInitializing: false,
          queueStats: manager.getQueueStats(),
        }))

        return true
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isReady: false,
          isInitializing: false,
        }))
        return false
      }
    },
    [
      config.maxRetries,
      config.taskTimeout,
      config.enableProgressiveRendering,
      config.progressiveLevels,
    ]
  )
  // Resize worker canvas
  const resize = React.useCallback(async (width: number, height: number) => {
    const manager = workerManagerRef.current
    if (!manager || !manager.isReady()) return false
    try {
      const ok = await manager.resize(width, height)
      if (ok) {
        workerCanvasSizeRef.current = { width, height }
      }
      return ok
    } catch {
      return false
    }
  }, [])

  // Ensure worker canvas matches desired size before rendering
  const ensureCanvasSize = React.useCallback(
    async (width: number, height: number) => {
      const current = workerCanvasSizeRef.current
      if (!current || current.width !== width || current.height !== height) {
        await resize(width, height)
      }
    },
    [resize]
  )

  // Prepare for worker mode with shader warmup hints
  const prepareForWorkerMode = React.useCallback(
    async (visibleLayers: any[]) => {
      try {
        const manager = WorkerManager.getShared()
        // Collect shader warmup hints (basic set for now)
        const shaderNames = ["compositor", "adjustments.basic", "copy"]
        await manager.prepareWorkerShaders({ shaderNames })
      } catch {}
    },
    []
  )

  // Prewarm workers on mount to shorten initialize latency
  React.useEffect(() => {
    if (renderType === "hybrid") return

    const run = async () => {
      try {
        const manager = WorkerManager.getShared()
        await manager.prepare()
        workerManagerRef.current = manager
      } catch {}
    }
    void run()
  }, [renderType])

  // Set up event listeners for worker communication
  const setupEventListeners = React.useCallback(() => {
    const manager = workerManagerRef.current
    if (!manager) return

    // Remove any existing listeners to avoid duplicate handlers and stale closures
    const existingProgress = eventListenersRef.current.get("worker-progress")
    const existingError = eventListenersRef.current.get("worker-error")
    const existingSuccess = eventListenersRef.current.get("worker-success")
    if (existingProgress) {
      window.removeEventListener("worker-progress", existingProgress)
      eventListenersRef.current.delete("worker-progress")
    }
    if (existingError) {
      window.removeEventListener("worker-error", existingError)
      eventListenersRef.current.delete("worker-error")
    }
    if (existingSuccess) {
      window.removeEventListener("worker-success", existingSuccess)
      eventListenersRef.current.delete("worker-success")
    }

    // Progress event listener
    const progressHandler = (event: CustomEvent) => {
      const { taskId, progress } = event.detail
      setState((prev) => {
        if (taskId !== prev.currentTaskId) return prev
        // Avoid state churn on duplicate progress values
        if (prev.progress === progress) return prev
        return { ...prev, progress }
      })
    }

    // Error event listener
    const errorHandler = (event: CustomEvent) => {
      const { taskId, error } = event.detail
      if (taskId === state.currentTaskId) {
        setState((prev) => ({
          ...prev,
          error,
          isProcessing: false,
          currentTaskId: null,
          progress: 0,
        }))
      }
    }

    // Success event listener
    const successHandler = (event: CustomEvent) => {
      const { taskId } = event.detail
      console.log("🎨 [Worker] Success event received:", {
        taskId,
        currentTaskId: state.currentTaskId,
      })
      setState((prev) => {
        // If this is the current task, mark as completed
        if (taskId === prev.currentTaskId) {
          console.log(
            "🎨 [Worker] Current task completed successfully, setting isProcessing to false"
          )
          return {
            ...prev,
            isProcessing: false,
            currentTaskId: null,
            progress: 100,
            error: null,
          }
        }

        // If this is an older task completing, just log it but don't change state
        console.log("🎨 [Worker] Older task completed:", {
          taskId,
          currentTaskId: prev.currentTaskId,
        })
        return prev
      })
    }

    // Add event listeners
    const progressListener = progressHandler as EventListener
    const errorListener = errorHandler as EventListener
    const successListener = successHandler as EventListener

    window.addEventListener("worker-progress", progressListener)
    window.addEventListener("worker-error", errorListener)
    window.addEventListener("worker-success", successListener)

    // Track listeners for cleanup with handler references
    eventListenersRef.current.set("worker-progress", progressListener)
    eventListenersRef.current.set("worker-error", errorListener)
    eventListenersRef.current.set("worker-success", successListener)
  }, [state.currentTaskId])

  // Ensure processing flag resets when the queue goes idle (belt-and-suspenders)
  React.useEffect(() => {
    if (
      state.isProcessing &&
      state.queueStats.active === 0 &&
      state.queueStats.queued === 0
    ) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        currentTaskId: null,
      }))
    }
  }, [state.queueStats.active, state.queueStats.queued, state.isProcessing])

  // Render layers using worker
  const versionRef = React.useRef(0)

  // Intentionally stable; internal versionRef controls coalescing and tokening
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renderLayers = React.useCallback(
    async (
      layers: EditorLayer[],
      toolsValues: ImageEditorToolsState,
      selectedLayerId: string,
      canvasWidth: number,
      canvasHeight: number,
      layerDimensions: Map<
        string,
        { width: number; height: number; x: number; y: number }
      >,
      priority: TaskPriority = TaskPriority.HIGH,
      layersSignature?: string,
      interactive?: boolean,
      globalLayers?: Array<{
        id: string
        type: "adjustment" | "solid" | "mask"
        adjustmentType?: string
        parameters?: Record<string, any>
        color?: [number, number, number, number]
        enabled?: boolean
        inverted?: boolean
        visible: boolean
        opacity: number
        blendMode: string
      }>,
      globalParameters?: Record<
        string,
        number | { value: number; color: string }
      >
    ): Promise<string | null> => {
      const manager = workerManagerRef.current
      if (!manager || !manager.isReady()) {
        console.warn("Worker manager not ready")
        return null
      }

      try {
        // Cancel previous task if still processing
        if (state.currentTaskId) {
          manager.cancelTask(state.currentTaskId)
        }

        // Increment version for tokening; ensures worker can drop stale tasks
        versionRef.current += 1

        // Coalesce rapid calls in a short window (~16ms)
        if (coalesceTimerRef.current) {
          clearTimeout(coalesceTimerRef.current)
          coalesceTimerRef.current = null
        }

        if (!pendingPromiseRef.current) {
          let resolver: (id: string | null) => void
          const promise = new Promise<string | null>((resolve) => {
            resolver = resolve
          })
          // @ts-expect-error resolver is assigned synchronously
          pendingPromiseRef.current = { resolve: resolver, promise }
        }

        return await new Promise<string | null>((outerResolve) => {
          coalesceTimerRef.current = setTimeout(async () => {
            try {
              // Cancel previous task if still processing
              if (state.currentTaskId) {
                manager.cancelTask(state.currentTaskId)
              }

              // Map color profile to numeric flag: 0: srgb, 1: linear, 2: display-p3
              let colorSpaceFlag = 0
              try {
                // @ts-expect-error editor state available via hook
                const profile =
                  (state as any)?.canonical?.document?.colorProfile || "srgb"
                colorSpaceFlag =
                  profile === "linear" ? 1 : profile === "display-p3" ? 2 : 0
              } catch {}

              // Build compact per-layer pass-graph for worker: linearize -> effects -> encode
              const graph = layers.map((layer) => {
                const p: any = toolsValues
                const passes: any[] = []
                // 1) Linearize input for image/solid layers
                if (
                  (layer as any).type === "image" ||
                  (layer as any).type === "solid"
                ) {
                  passes.push({ shaderName: "color.linearize" })
                }
                // Minimal example graph: copy -> optional blur (h/v) -> effects -> adjustments
                if ((layer as any).type === "image") {
                  passes.push({
                    shaderName: "copy",
                    channels: { u_texture: "__LAYER__" },
                  })
                }
                if (Number((p as any).blur || 0) > 0) {
                  passes.push({
                    shaderName: "blur.separable",
                    passId: "h",
                    uniforms: { u_blur: Number((p as any).blur) },
                  })
                  passes.push({
                    shaderName: "blur.separable",
                    passId: "v",
                    uniforms: { u_blur: Number((p as any).blur) },
                    inputs: ["h"],
                  })
                }
                if (
                  Number((p as any).vintage || 0) > 0 ||
                  Number((p as any).sepia || 0) > 0 ||
                  Number((p as any).grayscale || 0) > 0 ||
                  Number((p as any).invert || 0) > 0
                ) {
                  passes.push({
                    shaderName: "effects.vintage",
                    uniforms: {
                      u_vintage: Number((p as any).vintage || 0),
                      u_invert: Number((p as any).invert || 0),
                      u_sepia: Number((p as any).sepia || 0),
                      u_grayscale: Number((p as any).grayscale || 0),
                      u_recolor: Number((p as any).colorize || 0),
                      u_vibrance: Number((p as any).vibrance || 0),
                      u_noise: Number((p as any).noise || 0),
                      u_grain: Number((p as any).grain || 0),
                    },
                  })
                }
                passes.push({
                  shaderName: "adjustments.basic",
                  uniforms: {
                    u_brightness: Number((p as any).brightness || 100),
                    u_contrast: Number((p as any).contrast || 100),
                    u_saturation: Number((p as any).saturation || 100),
                    u_hue: Number((p as any).hue || 0),
                    u_exposure: Number((p as any).exposure || 0),
                    u_gamma: Number((p as any).gamma || 1),
                    u_opacity: 100,
                  },
                })
                // 3) Encode to display profile at the end of per-layer graph when layer is terminal
                // Note: final frame also gets a global encode, but adding here makes each layer preview correct
                passes.push({ shaderName: "color.encode" })
                return { layerId: layer.id, passes }
              })

              const taskId = await manager.queueRenderTask(
                layers,
                toolsValues,
                selectedLayerId,
                canvasWidth,
                canvasHeight,
                layerDimensions,
                priority,
                {
                  signature: layersSignature ?? "",
                  version: versionRef.current,
                },
                interactive ?? false,
                colorSpaceFlag,
                graph,
                globalLayers,
                globalParameters
              )

              console.log("🎨 [Worker] Starting task:", { taskId })
              setState((prev) => ({
                ...prev,
                isProcessing: true,
                currentTaskId: taskId,
                progress: 0,
                error: null,
                queueStats: manager.getQueueStats(),
              }))

              pendingPromiseRef.current?.resolve(taskId)
              outerResolve(taskId)
            } catch (e) {
              const message = e instanceof Error ? e.message : "Unknown error"
              setState((prev) => ({ ...prev, error: message }))
              pendingPromiseRef.current?.resolve(null)
              outerResolve(null)
            } finally {
              pendingPromiseRef.current = null
              coalesceTimerRef.current = null
            }
          }, 16)
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isProcessing: false,
        }))
        return null
      }
    },
    // Accept stale closure of state; include state/currentTaskId to satisfy linter
    [state, state.currentTaskId]
  )

  // Apply filter to layer using worker
  const applyFilter = (
    layerId: string,
    filterType: string,
    parameters: any,
    imageData: ImageBitmap,
    priority: TaskPriority = TaskPriority.MEDIUM
  ): string | null => {
    const manager = workerManagerRef.current
    if (!manager || !manager.isReady()) {
      console.warn("Worker manager not ready")
      return null
    }

    try {
      // Queue filter task
      const taskId = manager.queueFilterTask(
        layerId,
        filterType,
        parameters,
        imageData,
        priority
      )

      // Update state
      setState((prev) => ({
        ...prev,
        queueStats: manager.getQueueStats(),
      }))

      return taskId
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }))
      return null
    }
  }

  // Cancel current task
  const cancelCurrentTask = () => {
    const manager = workerManagerRef.current
    if (!manager || !state.currentTaskId) return

    const cancelled = manager.cancelTask(state.currentTaskId)
    if (cancelled) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        currentTaskId: null,
        progress: 0,
        error: null,
      }))
    }
  }

  // Get task status
  const getTaskStatus = (taskId: string) => {
    const manager = workerManagerRef.current
    if (!manager) return "not-found"

    return manager.getTaskStatus(taskId)
  }

  // Update queue stats

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Remove tracked event listeners
      eventListenersRef.current.forEach((handler, eventType) => {
        window.removeEventListener(eventType, handler)
      })
      eventListenersRef.current.clear()

      const manager = workerManagerRef.current
      if (manager) {
        manager.cleanup()
        workerManagerRef.current = null
      }

      // Reset state to prevent memory leaks
      setState({
        isReady: false,
        isInitializing: false,
        isProcessing: false,
        currentTaskId: null,
        progress: 0,
        error: null,
        queueStats: { queued: 0, active: 0, total: 0 },
      })
    }
  }, [])

  // Update queue stats periodically
  React.useEffect(() => {
    const updateQueueStats = () => {
      const manager = workerManagerRef.current
      if (!manager) return
      const next = manager.getQueueStats()
      setState((prev) => {
        const same =
          prev.queueStats.queued === next.queued &&
          prev.queueStats.active === next.active &&
          prev.queueStats.total === next.total
        return same ? prev : { ...prev, queueStats: next }
      })
    }

    const interval = setInterval(updateQueueStats, 1000)
    return () => clearInterval(interval)
  }, [])

  return {
    // State
    isReady: state.isReady,
    isInitializing: state.isInitializing,
    isProcessing: state.isProcessing,
    currentTaskId: state.currentTaskId,
    progress: state.progress,
    error: state.error,
    queueStats: state.queueStats,

    // Actions
    initialize,
    ensureCanvasSize,
    resize,
    renderLayers,
    applyFilter,
    cancelCurrentTask,
    getTaskStatus,

    // Utilities
    canvasRef,
  }
}
