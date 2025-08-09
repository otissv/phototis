// Canvas State Manager to handle transitions between regular canvas and OffscreenCanvas

export enum CanvasState {
  REGULAR = "regular",
  TRANSFERRED = "transferred",
  ERROR = "error",
}

export interface CanvasStateInfo {
  state: CanvasState
  error?: string
  transferredAt?: number
}

export class CanvasStateManager {
  private static instance: CanvasStateManager
  private canvasStates = new Map<HTMLCanvasElement, CanvasStateInfo>()

  private constructor() {}

  static getInstance(): CanvasStateManager {
    if (!CanvasStateManager.instance) {
      CanvasStateManager.instance = new CanvasStateManager()
    }
    return CanvasStateManager.instance
  }

  // Check if canvas can be used for WebGL operations
  canUseForWebGL(canvas: HTMLCanvasElement): boolean {
    const state = this.getCanvasState(canvas)
    return state.state === CanvasState.REGULAR
  }

  // Check if canvas can be transferred to OffscreenCanvas
  canTransferToOffscreen(canvas: HTMLCanvasElement): boolean {
    const state = this.getCanvasState(canvas)
    return (
      state.state === CanvasState.REGULAR && !!canvas.transferControlToOffscreen
    )
  }

  // Mark canvas as transferred
  markAsTransferred(canvas: HTMLCanvasElement): void {
    this.canvasStates.set(canvas, {
      state: CanvasState.TRANSFERRED,
      transferredAt: Date.now(),
    })
  }

  // Mark canvas as having an error
  markAsError(canvas: HTMLCanvasElement, error: string): void {
    this.canvasStates.set(canvas, {
      state: CanvasState.ERROR,
      error,
    })
  }

  // Get canvas state
  getCanvasState(canvas: HTMLCanvasElement): CanvasStateInfo {
    const existing = this.canvasStates.get(canvas)
    if (existing) {
      return existing
    }

    // Check if canvas has already been transferred by trying to access transferControlToOffscreen
    // If the method doesn't exist, the canvas has been transferred
    if (!canvas.transferControlToOffscreen) {
      return {
        state: CanvasState.TRANSFERRED,
      }
    }

    // Check if OffscreenCanvas is supported
    if (typeof OffscreenCanvas === "undefined") {
      return {
        state: CanvasState.ERROR,
        error: "OffscreenCanvas not supported in this browser",
      }
    }

    return {
      state: CanvasState.REGULAR,
    }
  }

  // Check if canvas is in a valid state for the requested operation
  isValidForOperation(
    canvas: HTMLCanvasElement,
    operation: "webgl" | "offscreen"
  ): boolean {
    const state = this.getCanvasState(canvas)

    switch (operation) {
      case "webgl":
        return state.state === CanvasState.REGULAR
      case "offscreen":
        return (
          state.state === CanvasState.REGULAR &&
          !!canvas.transferControlToOffscreen
        )
      default:
        return false
    }
  }

  // Get error message for canvas
  getErrorMessage(canvas: HTMLCanvasElement): string | null {
    const state = this.getCanvasState(canvas)
    return state.error || null
  }

  // Clear canvas state (useful for testing or cleanup)
  clearCanvasState(canvas: HTMLCanvasElement): void {
    this.canvasStates.delete(canvas)
  }

  // Get all canvas states (for debugging)
  getAllCanvasStates(): Map<HTMLCanvasElement, CanvasStateInfo> {
    return new Map(this.canvasStates)
  }
}
