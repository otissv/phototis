# Asynchronous Rendering Pipeline Integration Guide

## Overview

This guide explains how to integrate the Asynchronous Rendering Pipeline with your existing HybridRenderer and Web Workers to achieve non-blocking GPU operations with multi-stage processing.

## Architecture Overview

### Components

1. **AsynchronousPipeline** (`asynchronous-pipeline.ts`)
   - Multi-stage rendering pipeline
   - Progressive rendering support
   - Memory monitoring and resource management
   - Task scheduling and prioritization

2. **HybridRenderer** (`hybrid-renderer.ts`)
   - Existing WebGL rendering engine
   - Layer compositing and blending
   - Shader management and FBO handling

3. **Render Worker** (`render-worker.ts`)
   - Web Worker with OffscreenCanvas
   - Non-blocking GPU operations
   - Security validation and error handling

4. **Worker Manager** (`worker-manager.ts`)
   - Task coordination and communication
   - Priority-based scheduling
   - Error recovery and retry mechanisms

## Integration Steps

### Step 1: Initialize Asynchronous Pipeline

```typescript
import { AsynchronousPipeline } from "@/lib/shaders/asynchronous-pipeline"

// Create pipeline with configuration
const pipeline = new AsynchronousPipeline({
  enableProgressiveRendering: true,
  progressiveLevels: [
    { level: 1, scale: 0.25, quality: 0.5, priority: 3 },
    { level: 2, scale: 0.5, quality: 0.8, priority: 2 },
    { level: 3, scale: 1.0, quality: 1.0, priority: 1 }
  ],
  maxConcurrentStages: 2,
  enableMemoryMonitoring: true
})

// Initialize with WebGL context
const success = pipeline.initialize({
  gl: webglContext,
  width: canvasWidth,
  height: canvasHeight
})
```

### Step 2: Integrate with Render Worker

Update your render worker to use the asynchronous pipeline:

```typescript
// In render-worker.ts
import { AsynchronousPipeline } from "@/lib/shaders/asynchronous-pipeline"

let asynchronousPipeline: AsynchronousPipeline | null = null

// Initialize pipeline in worker
function initializeWebGL(offscreenCanvas: OffscreenCanvas, width: number, height: number): boolean {
  try {
    // ... existing WebGL initialization ...
    
    // Initialize asynchronous pipeline
    asynchronousPipeline = new AsynchronousPipeline({
      enableProgressiveRendering: true,
      maxConcurrentStages: 2,
      enableMemoryMonitoring: true
    })
    
    const pipelineSuccess = asynchronousPipeline.initialize({ gl, width, height })
    if (!pipelineSuccess) {
      throw new Error("Failed to initialize asynchronous pipeline")
    }
    
    return true
  } catch (error) {
    console.error("Failed to initialize WebGL in worker:", error)
    return false
  }
}

// Use pipeline for rendering
async function renderLayers(layers, toolsValues, selectedLayerId, canvasWidth, canvasHeight, layerDimensions, messageId) {
  try {
    // Use asynchronous pipeline if available
    if (asynchronousPipeline) {
      const taskId = await asynchronousPipeline.queueRenderTask(
        layers,
        toolsValues,
        selectedLayerId,
        canvasWidth,
        canvasHeight,
        layerDimensions,
        1 // priority
      )
      
      // Pipeline handles rendering asynchronously
      postMessage({
        type: "success",
        id: messageId,
        data: { taskId }
      })
      return
    }
    
    // Fallback to synchronous rendering
    // ... existing synchronous rendering code ...
  } catch (error) {
    // ... error handling ...
  }
}
```

### Step 3: Update Worker Manager

Enhance the worker manager to handle pipeline events:

```typescript
// In worker-manager.ts
private handleWorkerMessage(event: MessageEvent): void {
  const message = event.data
  
  // Handle pipeline events
  if (message.type === "pipeline-progress") {
    this.handlePipelineProgress(message)
    return
  }
  
  if (message.type === "pipeline-success") {
    this.handlePipelineSuccess(message)
    return
  }
  
  if (message.type === "pipeline-error") {
    this.handlePipelineError(message)
    return
  }
  
  // ... existing message handling ...
}

private handlePipelineProgress(message: any): void {
  const { taskId, progress, stage } = message.detail
  this.emitProgress(taskId, progress, stage)
}

private handlePipelineSuccess(message: any): void {
  const { taskId, result } = message.detail
  this.emitSuccess(taskId, result)
}

private handlePipelineError(message: any): void {
  const { taskId, error } = message.detail
  this.emitError(taskId, error)
}
```

### Step 4: Update Canvas Component

Integrate the pipeline with your existing canvas component:

```typescript
// In canvas.image-editor.tsx
import { useWorkerRenderer } from "@/lib/hooks/useWorkerRenderer"

export function ImageEditorCanvas({ /* props */ }) {
  const {
    isReady: isWorkerReady,
    isProcessing: isWorkerProcessing,
    progress: workerProgress,
    error: workerError,
    initialize: initializeWorker,
    renderLayers: renderLayersWithWorker,
    cancelCurrentTask
  } = useWorkerRenderer({
    enableProgressiveRendering: true,
    progressiveLevels: [0.25, 0.5, 1.0],
    maxRetries: 3,
    taskTimeout: 30000
  })

  // Initialize worker with canvas
  React.useEffect(() => {
    if (!canvasRef?.current) return
    
    const canvas = canvasRef.current
    initializeWorker(canvas).then((success) => {
      if (!success) {
        console.error("Failed to initialize worker renderer")
      }
    })
  }, [canvasRef?.current, initializeWorker])

  // Use worker-based rendering
  const draw = React.useCallback(async () => {
    if (isDragActive || isDrawingRef.current) return
    
    isDrawingRef.current = true
    
    try {
      // Use worker-based rendering if available
      if (isWorkerReady && !isWorkerProcessing) {
        const canvas = canvasRef?.current
        if (!canvas) return
        
        const taskId = renderLayersWithWorker(
          layers,
          toolsValues,
          selectedLayerId,
          canvas.width,
          canvas.height,
          layerDimensions,
          priority
        )
        
        if (taskId) {
          // Worker is handling the rendering
          isDrawingRef.current = false
          return
        }
      }
      
      // Fallback to hybrid renderer
      // ... existing fallback code ...
    } finally {
      isDrawingRef.current = false
    }
  }, [/* dependencies */])

  return (
    <div>
      {/* Canvas */}
      <canvas ref={canvasRef} />
      
      {/* Pipeline progress indicator */}
      {isWorkerProcessing && (
        <div className="pipeline-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${workerProgress}%` }}
            />
          </div>
          <div className="progress-text">{workerProgress}%</div>
        </div>
      )}
      
      {/* Pipeline error indicator */}
      {workerError && (
        <div className="pipeline-error">
          <div className="error-message">{workerError}</div>
          <button onClick={cancelCurrentTask}>Cancel</button>
        </div>
      )}
    </div>
  )
}
```

## Pipeline Stages

### Stage 1: Preprocessing
- Validates image dimensions and layer data
- Prepares layer textures for rendering
- Implements security validation
- Progress: 0-25%

### Stage 2: Layer Rendering
- Applies filters and effects to individual layers
- Validates filter parameters
- Uses hybrid renderer for GPU operations
- Progress: 25-50%

### Stage 3: Compositing
- Combines layers using blend modes
- Handles layer ordering and opacity
- Manages FBO ping-pong for complex compositing
- Progress: 50-75%

### Stage 4: Final Output
- Renders final result to canvas
- Handles progressive quality updates
- Manages memory cleanup
- Progress: 75-100%

## Progressive Rendering

The pipeline supports progressive rendering with multiple quality levels:

```typescript
const progressiveLevels = [
  { level: 1, scale: 0.25, quality: 0.5, priority: 3 },  // Quick preview
  { level: 2, scale: 0.5, quality: 0.8, priority: 2 },   // Interactive preview
  { level: 3, scale: 1.0, quality: 1.0, priority: 1 }    // Final quality
]
```

Each level provides:
- **Immediate Feedback**: Low-resolution preview (25%)
- **Interactive Preview**: Medium resolution (50%)
- **Final Quality**: Full resolution (100%)

## Security Features

### Input Validation
```typescript
// Validate image dimensions
const validation = validateImageDimensions(width, height)
if (!validation.isValid) {
  throw new Error(validation.error)
}

// Validate filter parameters
const { validatedParameters, errors } = validateFilterParameters(parameters)
if (errors.length > 0) {
  console.warn("Parameter validation warnings:", errors)
}
```

### Memory Protection
```typescript
// Monitor GPU memory usage
if (this.memoryMonitor && !this.memoryMonitor.hasAvailableMemory()) {
  // Wait for memory to become available
  await this.waitForMemory()
}
```

## Error Handling

### Graceful Degradation
```typescript
// Try pipeline first, fallback to synchronous
if (asynchronousPipeline) {
  try {
    const taskId = await asynchronousPipeline.queueRenderTask(/* params */)
    return taskId
  } catch (error) {
    console.warn("Pipeline failed, falling back to synchronous:", error)
  }
}

// Fallback to synchronous rendering
return synchronousRender(/* params */)
```

### Retry Mechanisms
```typescript
// Automatic retry with exponential backoff
const retryWithBackoff = async (fn: Function, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
}
```

## Performance Optimization

### Memory Management
```typescript
// Resource pooling
const texturePool = new Map<string, WebGLTexture>()
const fboPool = new Map<string, FBO>()

// Reuse resources
const getTexture = (key: string) => {
  if (texturePool.has(key)) {
    return texturePool.get(key)
  }
  const texture = createTexture()
  texturePool.set(key, texture)
  return texture
}
```

### Caching Strategy
```typescript
// Cache rendered results
const resultCache = new Map<string, any>()

const getCachedResult = (key: string) => {
  if (resultCache.has(key)) {
    return resultCache.get(key)
  }
  return null
}

const cacheResult = (key: string, result: any) => {
  resultCache.set(key, result)
}
```

## Monitoring and Debugging

### Performance Metrics
```typescript
// Track pipeline performance
const metrics = {
  stageTimings: new Map<string, number>(),
  memoryUsage: 0,
  cacheHits: 0,
  cacheMisses: 0
}

// Monitor pipeline events
window.addEventListener('pipeline-progress', (event) => {
  const { taskId, progress, stage } = event.detail
  console.log(`Pipeline progress: ${progress}% at stage ${stage}`)
})
```

### Debug Tools
```typescript
// Enable debug mode
const pipeline = new AsynchronousPipeline({
  debug: true,
  logLevel: 'verbose'
})

// Get pipeline statistics
const stats = pipeline.getQueueStats()
console.log('Pipeline stats:', stats)
```

## Best Practices

### 1. Progressive Enhancement
- Start with basic functionality
- Add progressive rendering gradually
- Implement fallbacks for unsupported features

### 2. Memory Management
- Monitor GPU memory usage
- Implement automatic cleanup
- Use resource pooling

### 3. Error Handling
- Implement comprehensive error boundaries
- Provide clear error messages
- Maintain application state during errors

### 4. Performance Monitoring
- Track pipeline performance metrics
- Monitor memory usage
- Implement adaptive quality scaling

### 5. Security
- Validate all inputs
- Sanitize data between threads
- Implement proper error boundaries

## Troubleshooting

### Common Issues

1. **Pipeline Initialization Fails**
   - Check WebGL support
   - Verify canvas dimensions
   - Check console for error messages

2. **Memory Issues**
   - Monitor GPU memory usage
   - Implement proper cleanup
   - Reduce image resolution if needed

3. **Performance Problems**
   - Check pipeline queue status
   - Monitor stage timings
   - Adjust quality settings

### Debug Commands

```typescript
// Enable debug logging
const pipeline = new AsynchronousPipeline({ debug: true })

// Get detailed statistics
console.log(pipeline.getQueueStats())

// Monitor memory usage
console.log(pipeline.memoryMonitor?.getMemoryUsage())
```

This integration provides a robust, scalable solution for non-blocking GPU operations while maintaining security, performance, and reliability across different hardware configurations.
