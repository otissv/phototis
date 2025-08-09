// Simple test for CanvasStateManager
// This is a basic test to verify the canvas state manager works correctly

import { CanvasStateManager, CanvasState } from "./canvas-state-manager"

// Mock canvas for testing
const createMockCanvas = (hasTransferControl = true) => {
  const canvas = {
    transferControlToOffscreen: hasTransferControl ? () => ({}) : undefined,
  } as HTMLCanvasElement
  return canvas
}

// Test canvas state manager
export function testCanvasStateManager() {
  console.log("Testing CanvasStateManager...")

  const manager = CanvasStateManager.getInstance()

  // Test 1: Regular canvas
  const regularCanvas = createMockCanvas(true)
  console.log("Test 1 - Regular canvas:")
  console.log("  canUseForWebGL:", manager.canUseForWebGL(regularCanvas))
  console.log(
    "  canTransferToOffscreen:",
    manager.canTransferToOffscreen(regularCanvas)
  )
  console.log("  state:", manager.getCanvasState(regularCanvas))

  // Test 2: Transfer canvas
  manager.markAsTransferred(regularCanvas)
  console.log("Test 2 - After transfer:")
  console.log("  canUseForWebGL:", manager.canUseForWebGL(regularCanvas))
  console.log(
    "  canTransferToOffscreen:",
    manager.canTransferToOffscreen(regularCanvas)
  )
  console.log("  state:", manager.getCanvasState(regularCanvas))

  // Test 3: Already transferred canvas
  const transferredCanvas = createMockCanvas(false)
  console.log("Test 3 - Already transferred canvas:")
  console.log("  canUseForWebGL:", manager.canUseForWebGL(transferredCanvas))
  console.log(
    "  canTransferToOffscreen:",
    manager.canTransferToOffscreen(transferredCanvas)
  )
  console.log("  state:", manager.getCanvasState(transferredCanvas))

  // Test 4: Error state
  const errorCanvas = createMockCanvas(true)
  manager.markAsError(errorCanvas, "Test error")
  console.log("Test 4 - Error state:")
  console.log("  canUseForWebGL:", manager.canUseForWebGL(errorCanvas))
  console.log(
    "  canTransferToOffscreen:",
    manager.canTransferToOffscreen(errorCanvas)
  )
  console.log("  state:", manager.getCanvasState(errorCanvas))
  console.log("  error:", manager.getErrorMessage(errorCanvas))

  console.log("CanvasStateManager tests completed!")
}

// Run test if this file is executed directly
if (typeof window !== "undefined") {
  // Only run in browser environment
  window.testCanvasStateManager = testCanvasStateManager
}
