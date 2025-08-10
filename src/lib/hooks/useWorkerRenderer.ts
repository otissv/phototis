// React hook for integrating worker-based rendering with canvas
// Provides non-blocking GPU operations using Web Workers and OffscreenCanvas

import React from "react"
import { WorkerManager, TaskPriority } from "@/lib/workers/worker-manager"
import type { Layer } from "@/components/image-editor/layer-system"
import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"

// Worker renderer state
interface WorkerRendererState {
  isReady: boolean
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
  const [state, setState] = React.useState<WorkerRendererState>({
    isReady: false,
    isProcessing: false,
    currentTaskId: null,
    progress: 0,
    error: null,
    queueStats: { queued: 0, active: 0, total: 0 },
  })

  const workerManagerRef = React.useRef<WorkerManager | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const eventListenersRef = React.useRef<Map<string, EventListener>>(new Map())

  // Initialize worker manager with canvas
  const initialize = React.useCallback(
    async (canvas: HTMLCanvasElement): Promise<boolean> => {
      try {
        // Check if already initialized
        if (workerManagerRef.current?.isReady()) {
          return true
        }

        setState((prev) => ({ ...prev, error: null }))

        // Create worker manager
        const manager = new WorkerManager({
          maxWorkers: 1,
          maxRetries: config.maxRetries || 3,
          taskTimeout: config.taskTimeout || 30000,
          enableProgressiveRendering: config.enableProgressiveRendering ?? true,
          progressiveLevels: config.progressiveLevels || [0.25, 0.5, 1.0],
        })

        // Initialize with canvas
        const success = await manager.initialize(canvas)

        if (!success) {
          throw new Error("Failed to initialize worker manager")
        }

        workerManagerRef.current = manager
        canvasRef.current = canvas

        // Set up event listeners
        setupEventListeners()

        setState((prev) => ({
          ...prev,
          isReady: true,
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

  // Set up event listeners for worker communication
  const setupEventListeners = React.useCallback(() => {
    const manager = workerManagerRef.current
    if (!manager) return

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
      setState((prev) => {
        if (taskId !== prev.currentTaskId) return prev
        return {
          ...prev,
          isProcessing: false,
          currentTaskId: null,
          progress: 100,
          error: null,
        }
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

  // Render layers using worker
  const versionRef = React.useRef(0)

  const renderLayers = React.useCallback(
    async (
      layers: Layer[],
      toolsValues: ImageEditorToolsState,
      selectedLayerId: string,
      canvasWidth: number,
      canvasHeight: number,
      layerDimensions: Map<
        string,
        { width: number; height: number; x: number; y: number }
      >,
      priority: TaskPriority = TaskPriority.HIGH,
      layersSignature?: string
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

        // Queue render task
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
          }
        )

        // Update state
        setState((prev) => ({
          ...prev,
          isProcessing: true,
          currentTaskId: taskId,
          progress: 0,
          error: null,
          queueStats: manager.getQueueStats(),
        }))

        return taskId
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
    [state.currentTaskId]
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

      setState((prev) => ({
        ...prev,
        queueStats: manager.getQueueStats(),
      }))
    }

    const interval = setInterval(updateQueueStats, 1000)
    return () => clearInterval(interval)
  }, [])

  return {
    // State
    isReady: state.isReady,
    isProcessing: state.isProcessing,
    currentTaskId: state.currentTaskId,
    progress: state.progress,
    error: state.error,
    queueStats: state.queueStats,

    // Actions
    initialize,
    renderLayers,
    applyFilter,
    cancelCurrentTask,
    getTaskStatus,

    // Utilities
    canvasRef,
  }
}
