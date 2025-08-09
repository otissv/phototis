// Test rendering pipeline functionality

export function testRenderingPipeline(): void {
  console.log("=== Testing Rendering Pipeline ===")

  // Check if worker is ready
  const canvas = document.querySelector("canvas")
  if (!canvas) {
    console.error("No canvas found")
    return
  }

  console.log("Canvas found:", {
    width: canvas.width,
    height: canvas.height,
    hasTransferControl: !!canvas.transferControlToOffscreen,
  })

  // Test worker state
  const canvasStateManager = (window as any).CanvasStateManager?.getInstance()
  if (canvasStateManager) {
    const state = canvasStateManager.getCanvasState(canvas)
    console.log("Canvas state:", state)
  }

  // Test if worker is ready
  const workerReady = !!(window as any).workerManager?.isReady()
  console.log("Worker ready:", workerReady)

  // Test queue stats
  const queueStats = (window as any).workerManager?.getQueueStats()
  console.log("Queue stats:", queueStats)

  console.log("=== End Test ===")
}

export function forceRender(): void {
  console.log("=== Forcing Render ===")

  // Find the draw function and call it
  const canvas = document.querySelector("canvas")
  if (!canvas) {
    console.error("No canvas found")
    return
  }

  // Try to trigger a render by dispatching a custom event
  window.dispatchEvent(
    new CustomEvent("force-render", {
      detail: { timestamp: Date.now() },
    })
  )

  console.log("Force render event dispatched")
  console.log("=== End Force Render ===")
}

// Make available globally for testing
if (typeof window !== "undefined") {
  ;(window as any).testRenderingPipeline = testRenderingPipeline
  ;(window as any).forceRender = forceRender
}
