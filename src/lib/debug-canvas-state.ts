// Debug utility for canvas state management

import { CanvasStateManager } from "./canvas-state-manager"

export function debugCanvasState(canvas: HTMLCanvasElement): void {
  const manager = CanvasStateManager.getInstance()

  console.log("=== Canvas State Debug ===")
  console.log("Canvas element:", canvas)
  console.log(
    "Has transferControlToOffscreen:",
    !!canvas.transferControlToOffscreen
  )
  console.log(
    "OffscreenCanvas supported:",
    typeof OffscreenCanvas !== "undefined"
  )

  const state = manager.getCanvasState(canvas)
  console.log("Canvas state:", state)

  console.log("Can use for WebGL:", manager.canUseForWebGL(canvas))
  console.log(
    "Can transfer to OffscreenCanvas:",
    manager.canTransferToOffscreen(canvas)
  )

  console.log("All canvas states:", manager.getAllCanvasStates())
  console.log("=== End Debug ===")
}

export function testCanvasTransfer(canvas: HTMLCanvasElement): void {
  console.log("=== Testing Canvas Transfer ===")

  const manager = CanvasStateManager.getInstance()

  // Test initial state
  console.log("Initial state:", manager.getCanvasState(canvas))
  console.log("Can transfer initially:", manager.canTransferToOffscreen(canvas))

  // Test transfer
  try {
    if (manager.canTransferToOffscreen(canvas)) {
      console.log("Attempting transfer...")
      const offscreen = canvas.transferControlToOffscreen()
      manager.markAsTransferred(canvas)
      console.log("Transfer successful:", !!offscreen)
      console.log("State after transfer:", manager.getCanvasState(canvas))
      console.log(
        "Can transfer after transfer:",
        manager.canTransferToOffscreen(canvas)
      )
    } else {
      console.log("Cannot transfer canvas")
    }
  } catch (error) {
    console.error("Transfer failed:", error)
  }

  console.log("=== End Test ===")
}

// Make available globally for debugging
if (typeof window !== "undefined") {
  ;(window as any).debugCanvasState = debugCanvasState
  ;(window as any).testCanvasTransfer = testCanvasTransfer
}
