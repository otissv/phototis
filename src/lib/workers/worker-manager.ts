// Worker Manager for coordinating Web Workers with OffscreenCanvas
// Manages communication between main thread and render workers

import type { Layer } from "@/components/image-editor/layer-system"
import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"
import { CanvasStateManager } from "@/lib/canvas-state-manager"

// Worker message types
export interface WorkerMessage {
  type: string
  id: string
  data?: any
}

export interface ProgressMessage {
  type: "progress"
  id: string
  progress: number
}

export interface ErrorMessage {
  type: "error"
  id: string
  error: string
}

export interface SuccessMessage {
  type: "success"
  id: string
  data?: any
}

// Task priority levels
export enum TaskPriority {
  CRITICAL = 0, // Immediate user feedback
  HIGH = 1, // Interactive operations
  MEDIUM = 2, // Background processing
  LOW = 3, // Cleanup operations
}

// Task interface
export interface RenderTask {
  id: string
  priority: TaskPriority
  type: "render" | "filter" | "initialize"
  data: any
  timestamp: number
  retryCount: number
  maxRetries: number
}

// Worker manager configuration
export interface WorkerManagerConfig {
  maxWorkers: number
  maxRetries: number
  taskTimeout: number
  enableProgressiveRendering: boolean
  progressiveLevels: number[]
}

export class WorkerManager {
  private workers: Worker[] = []
  private taskQueue: RenderTask[] = []
  private activeTasks: Map<string, RenderTask> = new Map()
  private messageHandlers: Map<string, (message: any) => void> = new Map()
  private config: WorkerManagerConfig
  private isInitialized = false
  private canvas: HTMLCanvasElement | null = null
  private offscreenCanvas: OffscreenCanvas | null = null

  constructor(config: Partial<WorkerManagerConfig> = {}) {
    this.config = {
      maxWorkers: 1, // Start with single worker for OffscreenCanvas
      maxRetries: 3,
      taskTimeout: 30000, // 30 seconds
      enableProgressiveRendering: true,
      progressiveLevels: [0.25, 0.5, 1.0], // 25%, 50%, 100%
      ...config,
    }
  }

  // Initialize worker manager with canvas
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      const canvasStateManager = CanvasStateManager.getInstance()

      // Check if OffscreenCanvas is supported
      if (typeof OffscreenCanvas === "undefined") {
        throw new Error("OffscreenCanvas not supported in this browser")
      }

      // Check if canvas can be transferred
      if (!canvasStateManager.canTransferToOffscreen(canvas)) {
        const error =
          canvasStateManager.getErrorMessage(canvas) ||
          "Canvas cannot be transferred to OffscreenCanvas"
        throw new Error(error)
      }

      // Check if canvas has already been transferred
      if (this.offscreenCanvas) {
        console.warn("Canvas has already been transferred to OffscreenCanvas")
        return this.isInitialized
      }

      this.canvas = canvas

      // Transfer canvas control to OffscreenCanvas
      this.offscreenCanvas = canvas.transferControlToOffscreen()

      // Mark canvas as transferred
      canvasStateManager.markAsTransferred(canvas)

      // Create and initialize render worker
      const worker = new Worker(
        new URL("./render-worker.ts", import.meta.url),
        {
          type: "module",
        }
      )

      // Set up message handler
      worker.onmessage = this.handleWorkerMessage.bind(this)
      worker.onerror = this.handleWorkerError.bind(this)

      this.workers.push(worker)

      const initSuccess = await this.sendMessage(worker, {
        type: "initialize",
        data: {
          canvas: this.offscreenCanvas,
          width: canvas.width,
          height: canvas.height,
        },
      })

      // After transfer, the OffscreenCanvas is no longer available in main thread
      // The worker now owns the canvas
      this.offscreenCanvas = null

      if (!initSuccess) {
        throw new Error("Failed to initialize render worker")
      }

      this.isInitialized = true
      return true
    } catch (error) {
      return false
    }
  }

  // Send message to worker and wait for response
  private async sendMessage(worker: Worker, message: any): Promise<boolean> {
    return new Promise((resolve) => {
      const messageId = message.id || this.generateMessageId()

      // Set up one-time message handler
      const handler = (response: any) => {
        if (response.id === messageId) {
          // Only resolve on success or error, not on progress
          if (response.type === "success" || response.type === "error") {
            this.messageHandlers.delete(messageId)
            resolve(response.type === "success")
          }
          // For progress messages, don't resolve yet - wait for success/error
        }
      }

      this.messageHandlers.set(messageId, handler)

      // Send message with ID
      const messageToSend = {
        ...message,
        id: messageId,
      }

      // If this is an initialization message with OffscreenCanvas, use transfer
      if (message.type === "initialize" && message.data?.canvas) {
        try {
          worker.postMessage(messageToSend, [message.data.canvas])
        } catch (error) {
          resolve(false)
          return
        }
      } else {
        worker.postMessage(messageToSend)
      }

      // Set timeout for response
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId)
          resolve(false)
        }
      }, this.config.taskTimeout)
    })
  }

  // Handle messages from workers
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data

    // Check for registered handlers
    const handler = this.messageHandlers.get(message.id)
    if (handler) {
      handler(message)
      // Do not return here; also route through the generic handlers below
    }

    // Handle progress updates
    if (message.type === "progress") {
      this.handleProgressUpdate(message)
      return
    }

    // Handle errors
    if (message.type === "error") {
      this.handleError(message)
      return
    }

    // Handle success
    if (message.type === "success") {
      this.handleSuccess(message)
      // Also update queue stats event for the UI
      this.emitProgress(message.id, 100)
      return
    }
  }

  // Handle worker errors
  private handleWorkerError(event: ErrorEvent): void {
    this.handleError({
      type: "error",
      id: "worker-error",
      error: event.error?.message || "Unknown worker error",
    })
  }

  // Handle progress updates
  private handleProgressUpdate(message: ProgressMessage): void {
    // Emit progress event for UI updates
    this.emitProgress(message.id, message.progress)
  }

  // Handle errors
  private handleError(message: ErrorMessage): void {
    // Find and retry failed task
    const task = this.activeTasks.get(message.id)
    if (task && task.retryCount < task.maxRetries) {
      task.retryCount++
      this.retryTask(task)
    } else {
      // Remove from active tasks
      this.activeTasks.delete(message.id)

      // Emit error event
      this.emitError(message.id, message.error)
    }
  }

  // Handle success
  private handleSuccess(message: SuccessMessage): void {
    // Remove from active tasks
    this.activeTasks.delete(message.id)

    // Emit success event
    this.emitSuccess(message.id, message.data)
  }

  // Retry failed task
  private retryTask(task: RenderTask): void {
    // Add back to queue with higher priority
    task.priority = Math.max(0, task.priority - 1)
    this.queueTask(task)
  }

  // Queue a render task
  async queueRenderTask(
    layers: Layer[],
    toolsValues: ImageEditorToolsState,
    selectedLayerId: string,
    canvasWidth: number,
    canvasHeight: number,
    layerDimensions: Map<
      string,
      { width: number; height: number; x: number; y: number }
    >,
    priority: TaskPriority = TaskPriority.HIGH
  ): Promise<string> {
    const taskId = this.generateMessageId()

    // Convert File objects to ImageBitmap for worker compatibility
    const processedLayers = await Promise.all(
      layers.map(async (layer) => {
        if (layer.image instanceof File) {
          try {
            const file = layer.image
            const imageBitmap = await createImageBitmap(file)
            const imageSignature = `${file.name}:${file.size}:${file.lastModified}`
            return {
              ...layer,
              // Replace File with ImageBitmap for worker consumption
              image: imageBitmap,
              // Attach a stable signature for caching/invalidation in worker
              imageSignature,
            } as any
          } catch (error) {
            console.warn(
              `Failed to convert File to ImageBitmap for layer ${layer.id}:`,
              error
            )
            return layer
          }
        }
        return layer
      })
    )

    const task: RenderTask = {
      id: taskId,
      priority,
      type: "render",
      data: {
        layers: processedLayers,
        toolsValues,
        selectedLayerId,
        canvasWidth,
        canvasHeight,
        layerDimensions: Array.from(layerDimensions.entries()),
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    }

    this.queueTask(task)
    return taskId
  }

  // Queue a filter task
  queueFilterTask(
    layerId: string,
    filterType: string,
    parameters: any,
    imageData: ImageBitmap,
    priority: TaskPriority = TaskPriority.MEDIUM
  ): string {
    const taskId = this.generateMessageId()

    const task: RenderTask = {
      id: taskId,
      priority,
      type: "filter",
      data: {
        layerId,
        filterType,
        parameters,
        imageData,
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    }

    this.queueTask(task)
    return taskId
  }

  // Add task to queue
  private queueTask(task: RenderTask): void {
    // Insert task based on priority (lower number = higher priority)
    let insertIndex = 0
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority > task.priority) {
        insertIndex = i + 1
      } else {
        break
      }
    }

    this.taskQueue.splice(insertIndex, 0, task)

    // Process queue
    this.processQueue()
  }

  // Process task queue
  private processQueue(): void {
    if (!this.isInitialized || this.workers.length === 0) {
      return
    }

    // Find available worker
    const worker = this.workers[0] // For now, use single worker

    // Process tasks
    while (
      this.taskQueue.length > 0 &&
      this.activeTasks.size < this.config.maxWorkers
    ) {
      const task = this.taskQueue.shift()
      if (!task) break

      // Add to active tasks
      this.activeTasks.set(task.id, task)

      // Send to worker
      this.sendTaskToWorker(worker, task)
    }
  }

  // Send task to worker
  private async sendTaskToWorker(
    worker: Worker,
    task: RenderTask
  ): Promise<void> {
    try {
      // Send message with task ID so worker can use it for responses
      const success = await this.sendMessage(worker, {
        type: task.type,
        id: task.id, // Use task ID instead of generating new one
        data: task.data,
      })
    } catch (error) {
      console.error(`Failed to send task ${task.id} to worker:`, error)
      this.activeTasks.delete(task.id)
    }
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Event emitters
  private emitProgress(taskId: string, progress: number): void {
    // Dispatch custom event for progress updates
    window.dispatchEvent(
      new CustomEvent("worker-progress", {
        detail: { taskId, progress },
      })
    )
  }

  private emitError(taskId: string, error: string): void {
    // Dispatch custom event for errors
    window.dispatchEvent(
      new CustomEvent("worker-error", {
        detail: { taskId, error },
      })
    )
  }

  private emitSuccess(taskId: string, data?: any): void {
    // Dispatch custom event for success
    window.dispatchEvent(
      new CustomEvent("worker-success", {
        detail: { taskId, data },
      })
    )
  }

  // Cancel task
  cancelTask(taskId: string): boolean {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex((task) => task.id === taskId)
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1)
      return true
    }

    // Remove from active tasks
    if (this.activeTasks.has(taskId)) {
      this.activeTasks.delete(taskId)
      return true
    }

    return false
  }

  // Get task status
  getTaskStatus(
    taskId: string
  ): "queued" | "active" | "completed" | "failed" | "not-found" {
    if (this.taskQueue.some((task) => task.id === taskId)) {
      return "queued"
    }

    if (this.activeTasks.has(taskId)) {
      return "active"
    }

    // Check if task was completed (this would need to be tracked separately)
    return "not-found"
  }

  // Get queue statistics
  getQueueStats(): {
    queued: number
    active: number
    total: number
  } {
    return {
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
      total: this.taskQueue.length + this.activeTasks.size,
    }
  }

  // Cleanup
  cleanup(): void {
    // Cancel all tasks
    this.taskQueue.length = 0
    this.activeTasks.clear()

    // Terminate workers
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers.length = 0

    // Clear message handlers
    this.messageHandlers.clear()

    this.isInitialized = false
    this.canvas = null
    this.offscreenCanvas = null
  }

  // Check if initialized
  isReady(): boolean {
    return this.isInitialized
  }
}
