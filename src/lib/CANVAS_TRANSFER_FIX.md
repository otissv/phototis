# Canvas Transfer Fix

## Problem
The error `DOMException: An attempt was made to use an object that is not, or is no longer, usable` occurs when:
1. A canvas is transferred to an OffscreenCanvas using `transferControlToOffscreen()`
2. The same canvas is then used for WebGL operations on the main thread
3. Multiple attempts to transfer the same canvas

## Root Cause
The canvas becomes unusable on the main thread after being transferred to an OffscreenCanvas. The original implementation didn't properly track canvas state transitions.

## Solution

### 1. Canvas State Manager
Created `CanvasStateManager` to track canvas states:
- **REGULAR**: Canvas can be used for WebGL operations
- **TRANSFERRED**: Canvas has been transferred to OffscreenCanvas
- **ERROR**: Canvas has encountered an error

### 2. State Validation
Before any canvas operation, validate the canvas state:
```typescript
const canvasStateManager = CanvasStateManager.getInstance()

// Check if canvas can be used for WebGL
if (!canvasStateManager.canUseForWebGL(canvas)) {
  console.warn("Canvas cannot be used for WebGL operations")
  return
}

// Check if canvas can be transferred
if (!canvasStateManager.canTransferToOffscreen(canvas)) {
  throw new Error("Canvas cannot be transferred to OffscreenCanvas")
}
```

### 3. Proper State Transitions
When transferring canvas:
```typescript
// Transfer canvas
this.offscreenCanvas = canvas.transferControlToOffscreen()

// Mark as transferred
canvasStateManager.markAsTransferred(canvas)
```

### 4. Updated Components

#### Worker Manager (`worker-manager.ts`)
- Added canvas state validation before transfer
- Marks canvas as transferred after successful transfer
- Prevents multiple transfer attempts

#### Canvas Component (`canvas.image-editor.tsx`)
- Added canvas state checks before WebGL initialization
- Added canvas state checks before hybrid renderer initialization
- Added canvas state checks in draw function
- Graceful fallback when canvas is transferred

## Implementation Details

### Canvas State Manager
```typescript
export class CanvasStateManager {
  private canvasStates = new Map<HTMLCanvasElement, CanvasStateInfo>()

  canUseForWebGL(canvas: HTMLCanvasElement): boolean {
    const state = this.getCanvasState(canvas)
    return state.state === CanvasState.REGULAR
  }

  canTransferToOffscreen(canvas: HTMLCanvasElement): boolean {
    const state = this.getCanvasState(canvas)
    return state.state === CanvasState.REGULAR && !!canvas.transferControlToOffscreen
  }

  markAsTransferred(canvas: HTMLCanvasElement): void {
    this.canvasStates.set(canvas, {
      state: CanvasState.TRANSFERRED,
      transferredAt: Date.now()
    })
  }
}
```

### Worker Manager Integration
```typescript
async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
  const canvasStateManager = CanvasStateManager.getInstance()

  // Check if canvas can be transferred
  if (!canvasStateManager.canTransferToOffscreen(canvas)) {
    const error = canvasStateManager.getErrorMessage(canvas) || "Canvas cannot be transferred"
    throw new Error(error)
  }

  // Transfer canvas
  this.offscreenCanvas = canvas.transferControlToOffscreen()
  
  // Mark as transferred
  canvasStateManager.markAsTransferred(canvas)
}
```

### Canvas Component Integration
```typescript
// WebGL initialization
React.useEffect(() => {
  const canvas = canvasRef.current
  const canvasStateManager = CanvasStateManager.getInstance()

  if (!canvasStateManager.canUseForWebGL(canvas)) {
    console.warn("Canvas cannot be used for WebGL operations")
    return
  }

  const gl = canvas.getContext("webgl2", { /* options */ })
  // ... rest of initialization
}, [canvasRef?.current])
```

## Benefits

1. **Prevents Errors**: Validates canvas state before operations
2. **Clear State Management**: Tracks canvas transitions explicitly
3. **Graceful Degradation**: Falls back when canvas is transferred
4. **Debugging Support**: Provides error messages and state information
5. **Singleton Pattern**: Single source of truth for canvas states

## Testing

Run the canvas state manager test:
```typescript
// In browser console
window.testCanvasStateManager()
```

This will test:
- Regular canvas operations
- Canvas transfer
- Already transferred canvas
- Error states

## Usage

The fix is transparent to existing code. The canvas state manager automatically:
1. Detects canvas state
2. Validates operations
3. Provides appropriate error messages
4. Prevents invalid operations

## Migration

No migration required. The fix is backward compatible and automatically handles:
- Existing canvas usage
- Canvas transfer operations
- Error conditions
- State transitions
