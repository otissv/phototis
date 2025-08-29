# State Management Guide

This document explains the dual state management architecture used in the image editor and provides guidelines for when and how to use each approach.

## Overview

The project uses **two separate state management systems** that work together:

1. **Image Editor Tools State** - React reducer for tool values and filters
2. **Editor State** - Command-driven architecture for structural changes

## Architecture

### 1. Image Editor Tools State (`tools-state.tsx`)

**Purpose**: Manages the current values of image editing tools and filters.

**Characteristics**:
- Uses traditional React `useReducer` pattern
- **Immediate updates** - no undo/redo for individual tool changes
- **Lightweight** - stores simple values (numbers, strings, booleans)
- **Fast UI updates** - ideal for real-time slider movements
- **No persistence** - values reset on page reload

**Use Cases**:
- Brightness, contrast, saturation sliders
- Color picker values
- Tool settings and preferences
- Filter intensity values
- Real-time preview adjustments

**Example**:
```typescript
// Tool value changes
dispatch({ type: "brightness", payload: 50 })
dispatch({ type: "contrast", payload: 25 })
dispatch({ type: "recolor", payload: { value: 0.8, color: "#ff0000" } })
```

### 2. Editor State (`state.ts` + `commands.ts`)

**Purpose**: Manages the core editor structure, layers, selection, and viewport.

**Characteristics**:
- Uses **Command Pattern** with full undo/redo support
- **Persistent** - saved to localStorage across sessions
- **Heavy operations** - structural changes that need to be reversible
- **Transaction support** - groups related operations together
- **Memory management** - tracks command sizes and limits history

**Use Cases**:
- Adding/removing layers
- Reordering layers
- Changing layer properties (opacity, blend mode, visibility)
- Document operations (resize, rotate, flip)
- Selection changes
- Viewport changes (zoom, pan)

**Example**:
```typescript
// Structural changes
history.execute(new AddLayerCommand(newLayer, "top"))
history.execute(new UpdateLayerCommand(layerId, { opacity: 50 }))
history.execute(new DocumentRotateCommand(90))
```

## When to Use Each System

### Use Image Editor Tools State When:

✅ **Tool value changes** (brightness: 0 → 50)
✅ **Real-time preview updates** (slider movements)
✅ **Filter parameter adjustments** (blur radius, grain intensity)
✅ **Color picker selections** (hex values, RGB values)
✅ **Immediate UI feedback** needed
✅ **No undo/redo required** for individual changes

### Use Editor State (Commands) When:

✅ **Structural changes** (add/remove layers)
✅ **Layer property changes** (opacity, blend mode, visibility)
✅ **Document operations** (resize, rotate, flip)
✅ **Selection changes** (which layers are selected)
✅ **Viewport changes** (zoom, pan, rotation)
✅ **Operations that need undo/redo**
✅ **Changes that should persist** across sessions

## Implementation Guidelines

### Adding New Tool Values

1. **Update the state interface** in `tools-state.tsx`:
```typescript
export const initialToolsState: ImageEditorToolsState = {
  // ... existing values
  newTool: TOOL_VALUES.newTool.defaultValue,
}
```

2. **Add to the reducer**:
```typescript
case "newTool": {
  return {
    ...state,
    newTool: Math.max(0, Math.min(100, action.payload)),
  }
}
```

3. **Use in components**:
```typescript
const [state, dispatch] = useReducer(imageEditorToolsReducer, initialToolsState)
dispatch({ type: "newTool", payload: 75 })
```

### Adding New Editor Commands

1. **Create the command class** in `commands.ts`:
```typescript
export class NewOperationCommand implements Command {
  meta: CommandMeta
  private readonly parameter: any
  private previous?: any

  constructor(parameter: any, meta?: Partial<CommandMeta>) {
    this.parameter = parameter
    this.meta = {
      label: `New Operation`,
      scope: "layers", // or "document", "canvas", "tool"
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    // Store previous state for undo
    this.previous = /* capture current state */
    
    // Return new state
    return {
      ...state,
      // ... apply changes
    }
  }

  invert(): Command {
    // Return command that undoes this operation
    return new NewOperationCommand(this.previous)
  }

  estimateSize(): number {
    return 64 // Rough memory estimate
  }

  serialize(): SerializedCommand {
    return {
      type: "newOperation",
      meta: this.meta,
      parameter: this.parameter,
    }
  }
}
```

2. **Add to SerializedCommand union**:
```typescript
export type SerializedCommand =
  | { type: "addLayer"; /* ... */ }
  | { type: "newOperation"; /* ... */ }
```

3. **Add to deserialization**:
```typescript
export function deserializeCommand(json: SerializedCommand): Command {
  switch (json.type) {
    case "newOperation":
      return new NewOperationCommand(json.parameter, json.meta)
    // ... other cases
  }
}
```

4. **Add to EditorContext** in `context.tsx`:
```typescript
const newOperation = React.useCallback((parameter: any) => {
  historyRef.current?.execute(new NewOperationCommand(parameter))
}, [])

// Add to context value
const value: EditorContextValue = {
  // ... existing properties
  newOperation,
}
```

### Adding New Layer Properties

1. **Update the layer interfaces** in `state.ts`:
```typescript
export interface BaseLayer {
  id: LayerId
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  type: LayerType
  newProperty?: string // Add new property
}
```

2. **Update validation** in `validateEditorState`:
```typescript
// Add validation for new property
if (layer.newProperty && typeof layer.newProperty !== "string") {
  errors.push({
    path: `layers.byId.${id}.newProperty`,
    message: "newProperty must be a string",
  })
}
```

3. **Use UpdateLayerCommand** to modify the property:
```typescript
updateLayer(layerId, { newProperty: "new value" })
```

## State Update Patterns

### Immediate Tool Updates (Tools State)
```typescript
// For real-time slider movements
const handleSliderChange = (value: number) => {
  dispatch({ type: "brightness", payload: value })
}
```

### Persistent Changes (Editor State)
```typescript
// For changes that should be saved and undoable
const handleLayerOpacityChange = (opacity: number) => {
  updateLayer(layerId, { opacity })
}
```

### Transaction Groups
```typescript
// For multi-step operations
history.beginTransaction("Add Adjustment Layer")
history.push(new AddAdjustmentLayerCommand("brightness", { value: 0.5 }))
history.push(new SetSelectionCommand([newLayerId]))
history.endTransaction(true)
```

## Best Practices

### 1. **State Immutability**
- Never mutate input state objects
- Always return new state objects
- Use spread operator (`...`) for shallow copies
- Use `assertInvariants()` to validate new state

### 2. **Command Design**
- Keep commands focused and single-purpose
- Implement proper `invert()` methods for undo
- Provide meaningful labels for user interface
- Set appropriate scopes for organization

### 3. **Performance Considerations**
- Use `coalescable: true` for rapid successive changes
- Implement `estimateSize()` for memory management
- Group related operations in transactions
- Avoid unnecessary state updates

### 4. **Error Handling**
- Validate inputs before creating commands
- Handle edge cases gracefully
- Provide meaningful error messages
- Log errors for debugging

### 5. **Testing**
- Test both state systems independently
- Test command inversion (undo/redo)
- Test state validation and invariants
- Test serialization/deserialization

## Common Patterns

### Tool Value with Preview
```typescript
// 1. Update tool state for immediate preview
dispatch({ type: "brightness", payload: value })

// 2. Commit change to layer when user finishes
updateLayer(layerId, { filters: { ...currentFilters, brightness: value } })
```

### Layer Property Change
```typescript
// Use command system for persistent changes
updateLayer(layerId, { 
  opacity: newOpacity,
  blendMode: newBlendMode 
})
```

### Document Operation
```typescript
// Use transaction for complex operations
history.beginTransaction("Rotate Document")
history.push(new DocumentRotateCommand(90))
history.push(new SetViewportCommand({ rotation: 90 }))
history.endTransaction(true)
```

## Migration Guide

### From Tools State to Editor State
If you need to make a tool value change persistent and undoable:

1. **Remove from tools state**
2. **Add as layer property** in editor state
3. **Use UpdateLayerCommand** instead of dispatch
4. **Update UI** to reflect the change

### From Editor State to Tools State
If you need faster updates for a property:

1. **Remove command-based updates**
2. **Add to tools state** with reducer
3. **Use dispatch** for immediate updates
4. **Consider** if the change needs persistence

## Troubleshooting

### Common Issues

1. **State not updating**: Check if you're using the correct state system
2. **Undo not working**: Ensure command implements proper `invert()` method
3. **Performance problems**: Check if operations can be coalesced
4. **Validation errors**: Verify state invariants are maintained

### Debug Tools

- Use `history.inspect()` to examine command history
- Check browser console for validation errors
- Use React DevTools to inspect component state
- Monitor localStorage for persistence issues

This dual state management approach provides the best of both worlds: fast, responsive UI updates for tool interactions and robust, persistent state management for structural changes.

## Complete Example: Brightness Adjustment

This example demonstrates how brightness adjustments work across both state systems, showing the complete flow from user interaction to persistent storage.

### 1. Component Implementation

```typescript
import React, { useState, useCallback } from "react"
import { useEditorContext } from "@/lib/editor/context"
import { useReducer } from "react"
import { imageEditorToolsReducer, initialToolsState } from "@/lib/state.image-editor"

function BrightnessControl() {
  const { updateLayer, getSelectedLayer } = useEditorContext()
  const [toolState, dispatch] = useReducer(imageEditorToolsReducer, initialToolsState)
  
  // Get currently selected layer for applying changes
  const selectedLayer = getSelectedLayer()
  
  // Handle real-time slider movement (Tools State)
  const handleSliderChange = useCallback((value: number) => {
    dispatch({ type: "brightness", payload: value })
  }, [])
  
  // Handle final brightness change (Editor State)
  const handleSliderCommit = useCallback((value: number) => {
    if (!selectedLayer) return
    
    // Update the layer's filters with the new brightness value
    updateLayer(selectedLayer.id, {
      filters: {
        ...selectedLayer.filters,
        brightness: value
      }
    })
  }, [selectedLayer, updateLayer])
  
  return (
    <div className="brightness-control">
      <label>Brightness: {toolState.brightness}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={toolState.brightness}
        onChange={(e) => handleSliderChange(Number(e.target.value))}
        onMouseUp={(e) => handleSliderCommit(Number(e.target.value))}
        onKeyUp={(e) => handleSliderCommit(Number(e.target.value))}
      />
    </div>
  )
}
```

### 2. State Flow Breakdown

#### **Phase 1: Real-time Preview (Tools State)**
```typescript
// User moves slider
handleSliderChange(75)

// Dispatches to tools reducer
dispatch({ type: "brightness", payload: 75 })

// Tools state updates immediately
// toolState.brightness = 75

// UI re-renders with new value
// Slider shows 75, label updates
```

#### **Phase 2: Persistent Change (Editor State)**
```typescript
// User releases slider (commits change)
handleSliderCommit(75)

// Creates UpdateLayerCommand
updateLayer(layerId, {
  filters: { ...currentFilters, brightness: 75 }
})

// Command executes through history manager
history.execute(new UpdateLayerCommand(layerId, {
  filters: { ...currentFilters, brightness: 75 }
}))
```

### 3. Command Execution Details

#### **UpdateLayerCommand.apply()**
```typescript
apply(state: CanonicalEditorState): CanonicalEditorState {
  const current = state.layers.byId[this.layerId]
  if (!current) return state

  // Store previous values for undo
  this.previous = {
    filters: { ...current.filters }
  }

  // Return new state with updated filters
  return {
    ...state,
    layers: {
      ...state.layers,
      byId: {
        ...state.layers.byId,
        [this.layerId]: {
          ...current,
          filters: {
            ...current.filters,
            ...this.patch.filters
          }
        }
      }
    }
  }
}
```

#### **UpdateLayerCommand.invert()**
```typescript
invert(): Command {
  // Return command that restores previous filter values
  return new UpdateLayerCommand(this.layerId, this.previous ?? {})
}
```

### 4. State Synchronization

#### **Tools State** (Immediate)
```typescript
// Current tool values for UI
{
  brightness: 75,        // ← Slider position
  contrast: 25,
  saturation: 50,
  // ... other tools
}
```

#### **Editor State** (Persistent)
```typescript
// Layer with applied filters
{
  id: "layer-1",
  name: "Background",
  type: "image",
  filters: {
    brightness: 75,      // ← Applied to layer
    contrast: 25,
    saturation: 50,
    // ... other filters
  }
}
```

### 5. Complete Data Flow

```
User moves slider
       ↓
dispatch({ type: "brightness", payload: 75 })
       ↓
Tools State updates: toolState.brightness = 75
       ↓
UI re-renders with new value
       ↓
User releases slider (commits)
       ↓
updateLayer(layerId, { filters: { brightness: 75 } })
       ↓
UpdateLayerCommand created
       ↓
Command executes through HistoryManager
       ↓
Layer filters updated in Editor State
       ↓
Change saved to localStorage
       ↓
Undo/redo available for this change
```

### 6. Benefits of This Approach

#### **Immediate Feedback**
- Slider moves smoothly without lag
- User sees brightness change in real-time
- No waiting for command execution

#### **Persistent Storage**
- Brightness value saved with document
- Survives page reloads
- Available in undo/redo history

#### **Performance**
- Tool state updates are lightweight
- No command overhead during slider movement
- Commands only execute on final commit

#### **User Experience**
- Responsive UI during adjustment
- Professional undo/redo support
- Changes persist across sessions

### 7. Alternative Implementation (Wrong Way)

❌ **Don't do this** - Using only commands for real-time updates:

```typescript
// This would be slow and create too many commands
const handleSliderChange = (value: number) => {
  updateLayer(layerId, { filters: { brightness: value } })
}
```

**Problems:**
- Creates command for every slider movement
- Slower UI response
- Fills undo history with intermediate values
- Poor performance

### 8. Key Takeaways

1. **Use Tools State** for immediate, real-time updates
2. **Use Editor State** for final, persistent changes
3. **Separate preview from commit** in the UI
4. **Leverage both systems** for optimal performance
5. **Maintain state consistency** between the two systems

This pattern ensures the best user experience while maintaining robust state management and undo/redo capabilities.
