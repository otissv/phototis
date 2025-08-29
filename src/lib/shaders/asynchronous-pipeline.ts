// Asynchronous Rendering Pipeline for non-blocking GPU operations
// Integrates with existing HybridRenderer to provide multi-stage processing

import type { Layer } from "@/layer-system/layer-system"
import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import { HybridRenderer, type HybridRendererOptions } from "./hybrid-renderer"
import {
  validateImageDimensions,
  validateFilterParameters,
} from "@/lib/security/gpu-security"

// Pipeline stage types
export enum PipelineStage {
  PREPROCESSING = "preprocessing",
  LAYER_RENDERING = "layer_rendering",
  COMPOSITING = "compositing",
  FINAL_OUTPUT = "final_output",
}

// Pipeline task interface
export interface PipelineTask {
  id: string
  stage: PipelineStage
  priority: number
  data: any
  timestamp: number
  dependencies: string[]
  result?: any
  error?: string
}

// Pipeline stage result
export interface StageResult {
  success: boolean
  data?: any
  error?: string
  progress: number
  stage: PipelineStage
}

// Lightweight event emitter interface to allow usage in workers without window
export interface PipelineEventEmitter {
  onProgress: (
    taskId: string,
    progress: number,
    stage: PipelineStage,
    data?: any
  ) => void
  onSuccess: (taskId: string, result: any) => void
  onError: (taskId: string, error: string) => void
}

// Progressive rendering levels
export interface ProgressiveLevel {
  level: number
  scale: number
  quality: number
  priority: number
}

// Pipeline configuration
export interface PipelineConfig {
  enableProgressiveRendering: boolean
  progressiveLevels: ProgressiveLevel[]
  maxConcurrentStages: number
  stageTimeout: number
  enableCaching: boolean
  enableMemoryMonitoring: boolean
  frameTimeTargetMs: number
}

export class AsynchronousPipeline {
  private hybridRenderer: HybridRenderer | null = null
  private config: PipelineConfig
  private taskQueue: PipelineTask[] = []
  private activeTasks: Map<string, PipelineTask> = new Map()
  private completedTasks: Map<string, PipelineTask> = new Map()
  private stageProcessors: Map<
    PipelineStage,
    (task: PipelineTask) => Promise<StageResult>
  > = new Map()
  private cache: Map<string, any> = new Map()
  private memoryMonitor: MemoryMonitor | null = null
  private eventEmitter: PipelineEventEmitter | null = null
  private isInteractive = false
  private lastTaskDurationMs = 0

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      enableProgressiveRendering: true,
      progressiveLevels: [
        { level: 1, scale: 0.25, quality: 0.5, priority: 3 },
        { level: 2, scale: 0.5, quality: 0.8, priority: 2 },
        { level: 3, scale: 1.0, quality: 1.0, priority: 1 },
      ],
      maxConcurrentStages: 2,
      stageTimeout: 30000,
      enableCaching: true,
      enableMemoryMonitoring: true,
      frameTimeTargetMs: 16.7,
      ...config,
    }

    this.initializeStageProcessors()
  }

  // Cancellation APIs for preemption from worker
  cancelAll(): void {
    // Clear queues and active tasks; best-effort cancellation
    this.taskQueue.length = 0
    this.activeTasks.clear()
  }

  cancelFamily(originalTaskId: string): void {
    // Remove queued tasks matching the family id and drop active entries
    this.taskQueue = this.taskQueue.filter(
      (t) => t.data?.originalTaskId !== originalTaskId
    )
    for (const [id, task] of Array.from(this.activeTasks.entries())) {
      if (task.data?.originalTaskId === originalTaskId) {
        this.activeTasks.delete(id)
      }
    }
  }

  // Optional event emitter override for environments without window (e.g., workers)
  setEventEmitter(eventEmitter: PipelineEventEmitter): void {
    this.eventEmitter = eventEmitter
  }

  // Initialize the pipeline with WebGL context
  initialize(options: HybridRendererOptions): boolean {
    try {
      // Create hybrid renderer
      this.hybridRenderer = new HybridRenderer()
      const success = this.hybridRenderer.initialize(options)

      if (!success) {
        throw new Error("Failed to initialize hybrid renderer")
      }

      // Initialize memory monitor if enabled
      if (this.config.enableMemoryMonitoring) {
        this.memoryMonitor = new MemoryMonitor(options.gl)
      }

      return true
    } catch (error) {
      console.error("Failed to initialize asynchronous pipeline:", error)
      return false
    }
  }

  // Initialize stage processors
  private initializeStageProcessors(): void {
    this.stageProcessors.set(
      PipelineStage.PREPROCESSING,
      this.processPreprocessing.bind(this)
    )
    this.stageProcessors.set(
      PipelineStage.LAYER_RENDERING,
      this.processLayerRendering.bind(this)
    )
    this.stageProcessors.set(
      PipelineStage.COMPOSITING,
      this.processCompositing.bind(this)
    )
    this.stageProcessors.set(
      PipelineStage.FINAL_OUTPUT,
      this.processFinalOutput.bind(this)
    )
  }

  // Queue a rendering task with progressive levels
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
    priority = 1
  ): Promise<string> {
    const taskId = this.generateTaskId()

    // Create progressive rendering tasks
    const tasks = []

    if (this.config.enableProgressiveRendering) {
      // Create tasks for each progressive level
      for (const level of this.getAdaptiveLevels()) {
        const task: PipelineTask = {
          id: `${taskId}_level_${level.level}`,
          stage: PipelineStage.PREPROCESSING,
          priority: priority + level.priority,
          data: {
            layers,
            toolsValues,
            selectedLayerId,
            canvasWidth: Math.floor(canvasWidth * level.scale),
            canvasHeight: Math.floor(canvasHeight * level.scale),
            layerDimensions,
            progressiveLevel: level,
            originalTaskId: taskId,
          },
          timestamp: Date.now(),
          dependencies: [],
        }
        tasks.push(task)
      }
    } else {
      // Single task for full resolution
      const task: PipelineTask = {
        id: taskId,
        stage: PipelineStage.PREPROCESSING,
        priority,
        data: {
          layers,
          toolsValues,
          selectedLayerId,
          canvasWidth,
          canvasHeight,
          layerDimensions,
          progressiveLevel: { level: 3, scale: 1.0, quality: 1.0, priority: 1 },
          originalTaskId: taskId,
        },
        timestamp: Date.now(),
        dependencies: [],
      }
      tasks.push(task)
    }

    // Add tasks to queue
    for (const task of tasks) {
      this.queueTask(task)
    }

    return taskId
  }

  // Determine adaptive levels based on recent frame-time and memory
  private getAdaptiveLevels(): ProgressiveLevel[] {
    const base = this.config.progressiveLevels
    const memOK = this.memoryMonitor?.hasAvailableMemory?.() ?? true
    if (!memOK) {
      return base.filter((l) => l.level < 3)
    }
    if (this.isInteractive) {
      return base.filter((l) => l.level <= 2)
    }
    if (this.lastTaskDurationMs > this.config.frameTimeTargetMs * 2) {
      return base.filter((l) => l.level < 3)
    }
    return base
  }

  // Queue a task
  private queueTask(task: PipelineTask): void {
    // Insert based on priority (lower number = higher priority)
    let insertIndex = 0
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority > task.priority) {
        insertIndex = i + 1
      } else {
        break
      }
    }

    this.taskQueue.splice(insertIndex, 0, task)
    this.processQueue()
  }

  // Process the task queue
  private async processQueue(): Promise<void> {
    while (
      this.taskQueue.length > 0 &&
      this.activeTasks.size < this.config.maxConcurrentStages
    ) {
      const task = this.taskQueue.shift()
      if (!task) break

      // Check memory before processing
      if (this.memoryMonitor && !this.memoryMonitor.hasAvailableMemory()) {
        // Put task back in queue and wait
        this.taskQueue.unshift(task)
        await this.waitForMemory()
        continue
      }

      this.activeTasks.set(task.id, task)
      this.processTask(task)
    }
  }

  // Process a single task through all stages
  private async processTask(task: PipelineTask): Promise<void> {
    try {
      const startTimeMs = Date.now()
      const stages = [
        PipelineStage.PREPROCESSING,
        PipelineStage.LAYER_RENDERING,
        PipelineStage.COMPOSITING,
        PipelineStage.FINAL_OUTPUT,
      ]

      for (const stage of stages) {
        task.stage = stage
        const processor = this.stageProcessors.get(stage)

        if (!processor) {
          throw new Error(`No processor found for stage: ${stage}`)
        }

        const result = await processor(task)

        if (!result.success) {
          throw new Error(result.error || `Stage ${stage} failed`)
        }

        task.result = result.data

        // Emit progress event
        this.emitProgress(task.id, result.progress, stage, result.data)
      }

      // Task completed successfully
      this.completedTasks.set(task.id, task)
      this.activeTasks.delete(task.id)
      this.emitSuccess(task.id, task.result)
      this.lastTaskDurationMs = Date.now() - startTimeMs

      // Clean up completed task after short delay to prevent memory buildup
      setTimeout(() => {
        this.completedTasks.delete(task.id)
        // Also clean up any cached data for this task
        this.cache.delete(task.id)
      }, 5000) // Keep for 5 seconds then clean up
    } catch (error) {
      // Task failed
      task.error = error instanceof Error ? error.message : "Unknown error"
      this.activeTasks.delete(task.id)
      this.emitError(task.id, task.error)
    }

    // Continue processing queue
    this.processQueue()
  }

  // Stage 1: Preprocessing and texture preparation
  private async processPreprocessing(task: PipelineTask): Promise<StageResult> {
    try {
      const { layers, canvasWidth, canvasHeight, layerDimensions } = task.data

      // Validate dimensions
      const validation = validateImageDimensions(canvasWidth, canvasHeight)
      if (!validation.isValid) {
        throw new Error(validation.error)
      }

      // Prepare layer textures
      const layerTextures = new Map<string, WebGLTexture>()

      for (const layer of layers) {
        // Validate layer dimensions
        const layerDim = layerDimensions.get(layer.id)
        if (layerDim) {
          const layerValidation = validateImageDimensions(
            layerDim.width,
            layerDim.height
          )
          if (!layerValidation.isValid) {
            console.warn(`Skipping layer ${layer.id} with invalid dimensions`)
            continue
          }
        }

        // Load layer texture (this would be implemented with actual texture loading)
        if (layer.image) {
          // Placeholder for texture loading
          const texture = await this.loadLayerTexture(
            layer,
            task.data.progressiveLevel
          )
          if (texture) {
            layerTextures.set(layer.id, texture)
          }
        }
      }

      return {
        success: true,
        data: { layerTextures },
        progress: 25,
        stage: PipelineStage.PREPROCESSING,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        progress: 0,
        stage: PipelineStage.PREPROCESSING,
      }
    }
  }

  // Public control to bias adaptive levels during user interaction
  setInteractive(isInteractive: boolean): void {
    this.isInteractive = isInteractive
  }

  // Stage 2: Individual layer rendering with filters
  private async processLayerRendering(
    task: PipelineTask
  ): Promise<StageResult> {
    try {
      const {
        layers,
        toolsValues,
        selectedLayerId,
        canvasWidth,
        canvasHeight,
        layerDimensions,
      } = task.data
      const { layerTextures } = task.result

      const renderedLayers = new Map<string, WebGLTexture>()

      for (const layer of layers) {
        const layerTexture = layerTextures.get(layer.id)
        if (!layerTexture) continue

        // Validate filter parameters
        const layerToolsValues =
          layer.id === selectedLayerId ? toolsValues : layer.filters
        const { validatedParameters, errors } =
          validateFilterParameters(layerToolsValues)

        if (errors.length > 0) {
          console.warn("Parameter validation warnings:", errors)
        }

        // Render layer with filters using hybrid renderer
        if (this.hybridRenderer) {
          const renderedTexture = this.hybridRenderer.renderLayer(
            layer,
            layerTexture,
            validatedParameters,
            canvasWidth,
            canvasHeight,
            layerDimensions
          )

          if (renderedTexture) {
            renderedLayers.set(layer.id, renderedTexture)
          }
        }
      }

      return {
        success: true,
        data: { renderedLayers },
        progress: 50,
        stage: PipelineStage.LAYER_RENDERING,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        progress: 25,
        stage: PipelineStage.LAYER_RENDERING,
      }
    }
  }

  // Stage 3: Layer compositing and blending
  private async processCompositing(task: PipelineTask): Promise<StageResult> {
    try {
      const { layers, canvasWidth, canvasHeight } = task.data
      const { renderedLayers } = task.result

      if (!this.hybridRenderer || renderedLayers.size === 0) {
        return {
          success: true,
          data: { finalTexture: null },
          progress: 75,
          stage: PipelineStage.COMPOSITING,
        }
      }

      // Composite layers using hybrid renderer
      let finalTexture: WebGLTexture | null = null

      // Get layers in rendering order (preserve incoming visual order)
      const orderedLayers = this.getRenderingOrder(layers)

      for (const layer of orderedLayers) {
        const layerTexture = renderedLayers.get(layer.id)
        if (!layerTexture) continue

        if (!finalTexture) {
          finalTexture = layerTexture
        } else {
          // Composite with previous result
          finalTexture = this.hybridRenderer.compositeLayers(
            finalTexture,
            layerTexture,
            layer.blendMode,
            layer.opacity,
            canvasWidth,
            canvasHeight
          )
        }
      }

      return {
        success: true,
        data: { finalTexture },
        progress: 75,
        stage: PipelineStage.COMPOSITING,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        progress: 50,
        stage: PipelineStage.COMPOSITING,
      }
    }
  }

  // Stage 4: Final output generation
  private async processFinalOutput(task: PipelineTask): Promise<StageResult> {
    try {
      const { canvasWidth, canvasHeight } = task.data
      const { finalTexture } = task.result

      if (!this.hybridRenderer) {
        throw new Error("Hybrid renderer not initialized")
      }

      // Render final result to canvas
      if (finalTexture) {
        return {
          success: true,
          data: { finalTexture, originalTaskId: task.data.originalTaskId },
          progress: 100,
          stage: PipelineStage.FINAL_OUTPUT,
        }
      }

      // Clear canvas if no layers
      return {
        success: true,
        data: { finalTexture: null, originalTaskId: task.data.originalTaskId },
        progress: 100,
        stage: PipelineStage.FINAL_OUTPUT,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        progress: 75,
        stage: PipelineStage.FINAL_OUTPUT,
      }
    }
  }

  // Helper methods
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async loadLayerTexture(
    layer: Layer,
    progressiveLevel: ProgressiveLevel
  ): Promise<WebGLTexture | null> {
    // Placeholder implementation - would load actual texture
    return null
  }

  private getRenderingOrder(layers: Layer[]): Layer[] {
    // Preserve the incoming array order (assumed bottom-to-top)
    // If visibility is managed elsewhere, upstream should filter hidden layers.
    return layers.slice()
  }

  private async waitForMemory(): Promise<void> {
    // Wait for memory to become available

    return new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Event emitters
  private emitProgress(
    taskId: string,
    progress: number,
    stage: PipelineStage,
    data?: any
  ): void {
    if (this.eventEmitter) {
      this.eventEmitter.onProgress(taskId, progress, stage, data)
      return
    }
    if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pipeline-progress", {
          detail: { taskId, progress, stage, data },
        })
      )
    }
  }

  private emitSuccess(taskId: string, result: any): void {
    if (this.eventEmitter) {
      this.eventEmitter.onSuccess(taskId, result)
      return
    }
    if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pipeline-success", {
          detail: { taskId, result },
        })
      )
    }
  }

  private emitError(taskId: string, error: string): void {
    if (this.eventEmitter) {
      this.eventEmitter.onError(taskId, error)
      return
    }
    if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pipeline-error", {
          detail: { taskId, error },
        })
      )
    }
  }

  // Public methods
  getTaskStatus(
    taskId: string
  ): "queued" | "active" | "completed" | "failed" | "not-found" {
    if (this.taskQueue.some((task) => task.id === taskId)) {
      return "queued"
    }

    if (this.activeTasks.has(taskId)) {
      return "active"
    }

    if (this.completedTasks.has(taskId)) {
      return "completed"
    }

    return "not-found"
  }

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

  getQueueStats(): {
    queued: number
    active: number
    completed: number
    total: number
  } {
    return {
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
      completed: this.completedTasks.size,
      total:
        this.taskQueue.length +
        this.activeTasks.size +
        this.completedTasks.size,
    }
  }

  cleanup(): void {
    // Cancel all tasks
    this.taskQueue.length = 0
    this.activeTasks.clear()
    this.completedTasks.clear()

    // Clean up hybrid renderer
    if (this.hybridRenderer) {
      this.hybridRenderer.cleanup()
      this.hybridRenderer = null
    }

    // Clear cache
    this.cache.clear()
  }
}

// Memory monitoring utility
class MemoryMonitor {
  private gl: WebGL2RenderingContext
  private memoryThreshold = 0.8 // 80% of available memory

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  hasAvailableMemory(): boolean {
    // This would implement actual GPU memory monitoring
    // For now, return true to allow processing
    return true
  }

  getMemoryUsage(): number {
    // This would return actual GPU memory usage
    return 0.5 // Placeholder
  }
}
