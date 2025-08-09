# OffscreenCanvas Transfer Fix

## Problem
The error `DOMException: OffscreenCanvas object could not be cloned` occurs because:
1. OffscreenCanvas objects cannot be serialized/cloned when sending messages to Web Workers
2. The transfer mechanism wasn't being used properly
3. Missing error handling for transfer operations

## Root Cause
When sending an OffscreenCanvas to a Web Worker, it must be transferred using the transfer list parameter of `postMessage()`. The object cannot be cloned because it contains non-serializable data.

## Solution

### 1. Proper Transfer Mechanism

#### Updated `WorkerManager.sendMessage()`:
```typescript
// Send message with ID
const messageToSend = {
  ...message,
  id: messageId,
}

// If this is an initialization message with OffscreenCanvas, use transfer
if (message.type === "initialize" && message.data?.canvas) {
  console.log("Sending initialization message with OffscreenCanvas transfer")
  try {
    worker.postMessage(messageToSend, [message.data.canvas])
  } catch (error) {
    console.error("Failed to send message with OffscreenCanvas transfer:", error)
    resolve(false)
    return
  }
} else {
  worker.postMessage(messageToSend)
}
```

### 2. Enhanced Error Handling

#### Updated initialization in `WorkerManager`:
```typescript
// Initialize worker with OffscreenCanvas
console.log("Initializing worker with OffscreenCanvas:", {
  hasOffscreenCanvas: !!this.offscreenCanvas,
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
})

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

console.log("Worker initialization result:", initSuccess)
```

#### Updated worker initialization:
```typescript
case "initialize": {
  const initMessage = message as InitializeMessage
  console.log("Worker received initialization message:", {
    hasCanvas: !!initMessage.data.canvas,
    width: initMessage.data.width,
    height: initMessage.data.height,
  })

  try {
    const success = initializeWebGL(
      initMessage.data.canvas,
      initMessage.data.width,
      initMessage.data.height
    )

    console.log("WebGL initialization result:", success)

    postMessage({
      type: success ? "success" : "error",
      id: message.id,
      error: success ? undefined : "Failed to initialize WebGL",
    } as SuccessMessage | ErrorMessage)
  } catch (error) {
    console.error("Worker initialization error:", error)
    postMessage({
      type: "error",
      id: message.id,
      error: error instanceof Error ? error.message : "Unknown initialization error",
    } as ErrorMessage)
  }
  break
}
```

### 3. Transfer Lifecycle Management

#### Canvas State After Transfer:
1. **Before Transfer**: Canvas has `transferControlToOffscreen()` method
2. **During Transfer**: OffscreenCanvas is created and transferred to worker
3. **After Transfer**: 
   - Original canvas loses `transferControlToOffscreen()` method
   - OffscreenCanvas is owned by the worker
   - Main thread cannot access the OffscreenCanvas

#### State Management:
```typescript
// Transfer canvas control to OffscreenCanvas
this.offscreenCanvas = canvas.transferControlToOffscreen()

// Mark canvas as transferred
canvasStateManager.markAsTransferred(canvas)

// Send to worker with transfer
worker.postMessage(message, [this.offscreenCanvas])

// After transfer, clear reference
this.offscreenCanvas = null
```

## Key Changes

### 1. Transfer List Usage
- **Before**: `worker.postMessage(message)` - tried to clone OffscreenCanvas
- **After**: `worker.postMessage(message, [offscreenCanvas])` - transfers ownership

### 2. Error Handling
- **Before**: No error handling for transfer operations
- **After**: Comprehensive error handling with logging

### 3. State Management
- **Before**: No cleanup after transfer
- **After**: Proper cleanup and state tracking

### 4. Debugging Support
- **Before**: No visibility into transfer process
- **After**: Detailed logging for debugging

## Testing

### 1. Test OffscreenCanvas Transfer
```javascript
// In browser console
window.testOffscreenCanvasTransfer()
```

This will test:
- OffscreenCanvas support detection
- Canvas transfer to OffscreenCanvas
- Worker creation and message transfer
- Error handling

### 2. Debug Canvas State
```javascript
// In browser console
const canvas = document.querySelector('canvas')
window.debugCanvasState(canvas)
```

### 3. Test Worker Initialization
```javascript
// In browser console
window.testCanvasTransfer(canvas)
```

## Expected Behavior

### 1. Successful Transfer
- Canvas transfers to OffscreenCanvas without errors
- Worker receives OffscreenCanvas and initializes WebGL
- Main thread no longer has access to the canvas

### 2. Error Handling
- Clear error messages if transfer fails
- Graceful fallback if OffscreenCanvas not supported
- Proper cleanup on errors

### 3. State Management
- Canvas state properly tracked
- No memory leaks from abandoned references
- Clear ownership transfer

## Browser Support

### Supported Browsers
- Chrome 69+
- Firefox 79+
- Safari 16.4+
- Edge 79+

### Fallback Behavior
- If OffscreenCanvas not supported, uses hybrid renderer
- If transfer fails, falls back to main thread rendering
- Clear error messages indicate the issue

## Debugging

### Common Issues and Solutions

1. **"OffscreenCanvas not supported"**
   - Browser doesn't support OffscreenCanvas
   - Falls back to hybrid renderer automatically

2. **"OffscreenCanvas object could not be cloned"**
   - Transfer list not used properly
   - Check that `postMessage(message, [offscreenCanvas])` is used

3. **"Canvas cannot be transferred"**
   - Canvas has already been transferred
   - Check canvas state with `debugCanvasState()`

4. **Worker initialization fails**
   - Check browser console for detailed error messages
   - Verify OffscreenCanvas support
   - Check worker file path and module loading

## Performance Impact

### Positive Changes
- **Proper transfer**: No cloning overhead
- **Better error handling**: Faster failure detection
- **State management**: Prevents invalid operations
- **Debugging**: Easier troubleshooting

### Monitoring
- Check console for transfer messages
- Monitor worker initialization
- Use debug utilities for troubleshooting

## Implementation Notes

### Transfer Process
1. Create OffscreenCanvas from HTMLCanvasElement
2. Transfer OffscreenCanvas to worker using transfer list
3. Worker initializes WebGL context on OffscreenCanvas
4. Main thread loses access to canvas
5. Worker owns the canvas for rendering

### Error Recovery
- If transfer fails, fall back to hybrid renderer
- If worker initialization fails, retry or fall back
- Clear error messages help with debugging

### Memory Management
- Transfer removes object from main thread
- Worker owns the OffscreenCanvas
- No memory leaks from abandoned references

This fix ensures proper OffscreenCanvas transfer while maintaining robust error handling and debugging capabilities.
