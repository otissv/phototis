// Worker Manager for coordinating Web Workers with OffscreenCanvas
// Manages communication between main thread and render workers

import type { EditorLayer } from "@/lib/editor/state"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import { CanvasStateManager } from "@/lib/canvas-state-manager"
import { config } from "@/config"

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

const { isDebug } = config()

export class WorkerManager {
  private static sharedInstance: WorkerManager | null = null
  private workers: Worker[] = []
  private filterWorker: Worker | null = null
  private renderWorker: Worker | null = null
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

  static getShared(config: Partial<WorkerManagerConfig> = {}): WorkerManager {
    if (!WorkerManager.sharedInstance) {
      WorkerManager.sharedInstance = new WorkerManager(config)
    }
    return WorkerManager.sharedInstance
  }

  // Emit debug timeline events to the window for instrumentation
  private emitDebug(stage: string, extra?: any): void {
    try {
      const detail = { stage, t: Date.now(), ...(extra || {}) }
      // Relay as a browser event
      window.dispatchEvent(
        new CustomEvent("worker-debug", {
          detail,
        })
      )
      // Also log to console for easier debugging without listeners
      if (typeof console !== "undefined" && console.debug && isDebug) {
        console.debug("[Worker Debug]", detail)
      }
    } catch {}
  }

  // Pre-create workers to warm the module/code-split chunks without requiring a canvas
  async prepare(): Promise<void> {
    this.emitDebug("manager:prepare:start")
    // Coalesce across instances
    if (__globalPrepared) {
      this.emitDebug("manager:prepare:skip-global")
      return
    }
    if (__globalPrepareInProgress && __globalPreparePromise) {
      await __globalPreparePromise
      this.emitDebug("manager:prepare:awaited")
      return
    }

    __globalPrepareInProgress = true
    __globalPreparePromise = (async () => {
      // Create and initialize render worker shell
      if (!this.renderWorker) {
        const worker = new Worker(
          new URL("./worker.renderer.ts", import.meta.url),
          { type: "module" }
        )
        worker.onmessage = this.handleWorkerMessage.bind(this)
        worker.onerror = this.handleWorkerError.bind(this)
        this.renderWorker = worker
        this.workers.push(worker)
        this.emitDebug("manager:prepare:render-worker-created")
      }
      // Do not create filter worker during prepare; defer until first use to minimize startup
      __globalPrepared = true
      this.emitDebug("manager:prepare:done")
    })()

    try {
      await __globalPreparePromise
    } finally {
      __globalPrepareInProgress = false
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
      this.emitDebug("manager:transfer:start")
      this.offscreenCanvas = canvas.transferControlToOffscreen()
      this.emitDebug("manager:transfer:done")

      // Mark canvas as transferred
      canvasStateManager.markAsTransferred(canvas)

      // Ensure we have a render worker (may be prewarmed)
      if (!this.renderWorker) {
        this.emitDebug("manager:prepare:call")
        const t0 = Date.now()
        await this.prepare()
        this.emitDebug("manager:prepare:returned", { dt: Date.now() - t0 })
      }
      const worker = this.renderWorker as Worker

      // Defer filter worker creation; reuse later when a filter task is queued
      if (this.filterWorker) {
        this.emitDebug("manager:filter:reuse")
      }

      this.emitDebug("manager:initialize:postMessage")
      const t1 = Date.now()
      const initSuccess = await this.sendMessage(worker, {
        type: "initialize",
        data: {
          canvas: this.offscreenCanvas,
          width: canvas.width,
          height: canvas.height,
        },
      })
      this.emitDebug("manager:initialize:result", {
        ok: initSuccess,
        dt: Date.now() - t1,
        data: {
          canvas: this.offscreenCanvas,
          width: canvas.width,
          height: canvas.height,
        },
      })

      // Sync shader registry (v2) to worker after init
      try {
        const { GlobalShaderRegistryV2 } = await import(
          "@/lib/shaders/registry.shader"
        )
        const version = GlobalShaderRegistryV2.getVersion()
        // Send full descriptors for dynamic plugin support
        const descriptors = GlobalShaderRegistryV2.getAll().map((d) => ({
          name: d.name,
          version: d.version,
          sources: d.sources
            ? {
                vertex: d.sources.vertex || null,
                fragment: d.sources.fragment || null,
              }
            : undefined,
          defines: d.defines || undefined,
          uniforms: d.uniforms || undefined,
          channels: d.channels || undefined,
          variants: d.variants || undefined,
          defaults: d.defaults || undefined,
          ui: d.ui || undefined,
          policies: d.policies || undefined,
          passes:
            d.passes?.map((p) => ({
              id: p.id,
              vertexSource: p.vertexSource || null,
              fragmentSource: p.fragmentSource,
              defines: p.defines || undefined,
              uniforms: p.uniforms || undefined,
              channels: p.channels || undefined,
              inputs: p.inputs || undefined,
            })) || undefined,
        }))
        await this.sendMessage(worker, {
          type: "shader:sync-registry",
          data: { version, descriptors },
        })
      } catch {}

      // After transfer, the OffscreenCanvas is no longer available in main thread
      // The worker now owns the canvas
      this.offscreenCanvas = null

      if (!initSuccess) {
        throw new Error("Failed to initialize render worker")
      }

      this.isInitialized = true
      return true
    } catch (error) {
      try {
        const canvasStateManager = CanvasStateManager.getInstance()
        const message =
          error instanceof Error
            ? error.message
            : "Unknown initialization error"
        if (this.canvas) {
          canvasStateManager.markAsError(this.canvas, message)
        } else {
          canvasStateManager.markAsError(canvas, message)
        }
      } catch {}
      return false
    }
  }

  // Resize the OffscreenCanvas owned by the render worker
  async resize(width: number, height: number): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.renderWorker) return false
      const ok = await this.sendMessage(this.renderWorker, {
        type: "resize",
        data: { width, height },
      })
      return ok
    } catch {
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

  // Prepare worker for mode switch with shader warmup hint
  async prepareWorkerShaders(
    hints: {
      shaderNames: string[]
      variantKeys?: string[]
      variants?: Record<string, string[]>
    } = {
      shaderNames: [],
    }
  ): Promise<boolean> {
    try {
      if (!this.renderWorker) return false
      // Pre-compute common heavy variants (e.g., blur types/kernels/passes)
      const enriched = this.buildPrewarmVariants(hints)
      return await this.sendMessage(this.renderWorker, {
        type: "shader:prepare",
        data: enriched,
      })
    } catch {
      return false
    }
  }

  // Build and cache prewarm variants for heavy shaders
  private buildPrewarmVariants(hints: {
    shaderNames: string[]
    variantKeys?: string[]
    variants?: Record<string, string[]>
  }): {
    shaderNames: string[]
    variantKeys?: string[]
    variants?: Record<string, string[]>
  } {
    const names = Array.from(new Set(hints.shaderNames || []))
    const variants: Record<string, string[]> = { ...(hints.variants || {}) }
    const flat = new Set(hints.variantKeys || [])

    // Example variant scheme for blur.separable: type-{gauss|box|motion|zoom}-pass-{h|v}-kern-{3|5|9}
    if (names.includes("blur.separable")) {
      const types = ["gauss", "box", "motion", "zoom"]
      const passes = ["h", "v"]
      const kernels = ["3", "5", "9", "13"]
      const list: string[] = []
      for (const t of types) {
        for (const p of passes) {
          for (const k of kernels) {
            list.push(`type-${t}-pass-${p}-kern-${k}`)
          }
        }
      }
      const prev = new Set(variants["blur.separable"] || [])
      for (const v of list) prev.add(v)
      variants["blur.separable"] = Array.from(prev)
    }

    // Vintage/effects variants (example): strength-{low|med|high}
    if (names.includes("effects.vintage")) {
      const list = ["strength-low", "strength-med", "strength-high"]
      const prev = new Set(variants["effects.vintage"] || [])
      for (const v of list) prev.add(v)
      variants["effects.vintage"] = Array.from(prev)
    }

    // Allow flat variantKeys to apply to all requested shaders
    if (flat.size) {
      for (const n of names) {
        const prev = new Set(variants[n] || [])
        for (const v of flat) prev.add(v)
        variants[n] = Array.from(prev)
      }
    }

    return { shaderNames: names, variantKeys: Array.from(flat), variants }
  }

  // Notify worker of GL context loss to rebuild shader caches
  async notifyContextLoss(): Promise<boolean> {
    try {
      if (!this.renderWorker) return false
      return await this.sendMessage(this.renderWorker, {
        type: "shader:context-loss",
      })
    } catch {
      return false
    }
  }

  // Handle messages from workers
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data
    // Debug timeline relay
    if (message.type === "debug") {
      try {
        const detail = {
          stage: message.stage,
          t: message.t || Date.now(),
          extra: message.extra || null,
        }
        window.dispatchEvent(
          new CustomEvent("worker-debug", {
            detail,
          })
        )
        // Also log to console for visibility without listeners
        if (typeof console !== "undefined" && console.debug && isDebug) {
          console.debug("[Worker Debug]", detail)
        }
      } catch {}
      return
    }

    // Check for registered handlers
    const handler = this.messageHandlers.get(message.id)
    if (handler) {
      handler(message)
      // Do not return here; also route through the generic handlers below
    }

    // Handle progress updates (also relay debug info if present)
    if (message.type === "progress") {
      if (message.dbg) {
        // Surface worker debug counters in devtools
        // developer diagnostics
      }
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
    if ((message as any).dbg) {
      // Surface debug info in devtools for diagnostics
      const dbg = (message as any).dbg
      console.debug("[render-worker] progress", message.progress, dbg)
    }
  }

  // Handle errors
  private handleError(message: ErrorMessage): void {
    // Structured error handling with simple backoff and token awareness
    const task = this.activeTasks.get(message.id)
    if (task && task.retryCount < task.maxRetries) {
      task.retryCount++
      // Exponential backoff (capped)
      const delay = Math.min(1000 * 2 ** (task.retryCount - 1), 4000)
      setTimeout(() => this.retryTask(task), delay)
      return
    }
    // Remove from active tasks and emit structured error
    this.activeTasks.delete(message.id)
    const code = message.error?.includes("HYBRID_FALLBACK_USED")
      ? "FALLBACK_USED"
      : message.error?.includes("WebGL")
        ? "WEBGL_ERROR"
        : "RENDER_ERROR"
    this.emitError(message.id, `${code}:${message.error}`)
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
    this.queueTask(task, "retry")
  }

  // Queue a render task
  async queueRenderTask(
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
    token?: { signature?: string; version?: number },
    interactive?: boolean,
    colorSpace?: number,
    graph?: unknown,
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
    >,
    playheadTime?: number
  ): Promise<string> {
    const taskId = this.generateMessageId()

    // Do not convert to ImageBitmap on the main thread; let the worker handle it.
    // Attach a stable signature for caching/invalidation in the worker.
    const processedLayers = layers.map((layer) => {
      const img: any = (layer as any).image
      if (img instanceof File) {
        const file = img as File
        const imageSignature = `${file.name}:${file.size}:${file.lastModified}`
        return {
          ...layer,
          imageSignature,
        } as any
      }
      return layer
    })

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
        priority,
        token: {
          signature: token?.signature ?? "",
          version: token?.version ?? 0,
        },
        interactive: !!interactive,
        // Optional enriched graph and colorSpace flags
        graph,
        colorSpace: typeof colorSpace === "number" ? colorSpace : 0,
        globalLayers,
        globalParameters,
        playheadTime: typeof playheadTime === "number" ? playheadTime : 0,
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    }

    this.queueTask(task, "render")
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
      data: { layerId, filterType, parameters, imageData },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    }
    // Ensure filter worker exists before queuing
    void (async () => {
      if (!this.filterWorker) {
        this.emitDebug("manager:filter:init:start")
        try {
          this.filterWorker = new Worker(
            new URL("./worker-filter.renderer.ts", import.meta.url),
            { type: "module" }
          )
          await this.sendMessage(this.filterWorker, { type: "initialize" })
          this.emitDebug("manager:filter:init:done")
        } catch (e) {
          this.emitDebug("manager:filter:init:error", {
            err: e instanceof Error ? e.message : String(e),
          })
        }
      }
      this.queueTask(task, "filter")
    })()
    return taskId
  }

  // Add task to queue
  private queueTask(
    task: RenderTask,
    type: "render" | "filter" | "retry"
  ): void {
    // Insert task based on priority (lower number = higher priority)
    let insertIndex = 0
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority > task.priority) {
        insertIndex = i + 1
      } else {
        break
      }
    }

    this.emitDebug("manager:queue:task", { type, task })

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
    const worker = this.workers[0]

    // Process tasks
    while (
      this.taskQueue.length > 0 &&
      this.activeTasks.size < this.config.maxWorkers
    ) {
      const task = this.taskQueue.shift()
      if (!task) break

      // Add to active tasks
      this.activeTasks.set(task.id, task)

      // Route filter tasks to the dedicated filter worker
      if (task.type === "filter" && this.filterWorker) {
        this.sendTaskToWorker(this.filterWorker, task)
      } else {
        this.sendTaskToWorker(worker, task)
      }
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

// Global prewarm state to coalesce concurrent prepare() calls across instances
let __globalPreparePromise: Promise<void> | null = null
let __globalPrepareInProgress = false
let __globalPrepared = false
