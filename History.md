## State History Manager

## Approach overview
- Use a command-driven, transactional history with diff-based storage (patches), not full snapshots.
- Make the scene graph (layers + transforms + effects) the single source of truth; canvas renders from this state.
- Tools never mutate state directly; they emit commands (with do/undo) and preview via ephemeral UI state.
- Support grouping, coalescing, memory limits, and serialization for full state restore.

## Core state model
- Single EditorState as the source of truth, including:
   - Layers: ordered IDs, per-layer props (name, type, src, transforms, effects, blend, opacity, visibility, lock).
   - Selection: selected layer IDs, handles.
   - Viewport/canvas: zoom, pan, rulers, snapping, guides.
   - Active tool and tool settings.
   - Document metadata: size, background, color profile.
   - Ephemeral interaction state (dragging, marquee preview) separate from EditorState. Commit changes to history only on interaction end.

## Command model
- Every user action is a Command with:
  - do(): apply the change to EditorState.
  - undo(): revert to prior state using inverse patches or stored before/after data.
  - metadata: scope (layers/tool/canvas), timestamp, coalescable, serializable payload.

- Command categories:
  - Layer structure: add/remove, reorder, group/ungroup, duplicate.
  - Layer properties: transform, opacity, blend, visibility, lock, mask, effects.
  - Canvas/viewport: zoom, pan, grid/snap toggles.
  - Tool actions: brush strokes, vector edits, text edits, crop, selection ops.
  - Global: document size/background, color adjustments, import/export.

- Coalescing rules:
  - Pointer-move streams (drag, brush) coalesce within a transaction; commit on pointerup.
  - Text edits coalesce per word or pause threshold.
  - Reorder drags coalesce to final drop.


## History manager
- Timeline with pointer (past/future) or ring buffer with capacity limit.
- APIs:
  - execute(command): clears redo branch, applies do(), pushes inverse to past.
  - undo()/redo(): move pointer and apply stored inverse/forward patches.
  - transactions: beginTransaction(name), push(command), endTransaction(commit=true). Nested allowed; cancel on escape/error.
  - checkpoints/markers: named restore points (e.g., after file open/import).

- Memory control:
  - Limit by total bytes; evict oldest by merging into a snapshot checkpoint.
  - Store compact diffs: structural patches for object graphs; for bitmaps store parametric ops instead of pixels, or delta-compressed tiles if raster edits are required.

- Branching:
- Simple mode: discard redo on new command.
- Optional advanced mode: keep DAG branches with “forked from” markers and a picker UI.

## Rendering and layer-system sync
- Render engine reads the layer order from EditorState.layers.order for deterministic z-order; never caches order elsewhere.
- Re-render triggered by state changes; memoize layer rasterization tiles keyed by layer props hash to avoid repainting unaffected layers.
- For heavy tool previews, draw to an overlay canvas during interaction; commit result via a command on end.


## Tools integration
- Tools emit:
  - Start (beginTransaction), Update (preview via ephemeral state, enqueue coalescable commands or accumulate deltas), End (commit consolidated command).

- Brush/paint/filter tools:
  - Record parameters and seed, not full pixel buffers; reapply deterministically on redo.
  - For truly raster destructive edits, store tile-level diffs with compression and caps.

- Transform/move/resize:
  - Store before/after transform matrices and affected IDs.

- Text/vector:
  - Store semantic edits (insert/delete, path ops) for compact, reliable undos.

## Performance and UX
- Coalesce aggressively; throttle Update emissions; commit on pointerup/blur/Enter.
- Group related operations (e.g., multi-layer align) into one transaction so Ctrl+Z is intuitive.
- Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+Y optional; disable during active transactions until commit.
- Visual affordances: show step labels in history UI; allow jump-to-checkpoint with confirmation.


## Persistence and restore
- Serialize:
  - Current EditorState.
  - History timeline metadata and compressed diffs.
  - Versioned schema with Zod validators and migration map.

- Storage:
  - In-session: memory + IndexedDB for autosave; optional local file export including history.
  - On load: validate schema with Zod, migrate, restore state, rebuild caches lazily.

- Fast resume:
  - Keep periodic full snapshots (e.g., every N commands or M seconds) to trim diffs and speed restoration.

## Reliability and safety
- Invertibility:
  - Ensure each command is either invertible or explicitly marked non-undoable with user confirmation before execution.
- Error handling:
  - If undo fails, attempt rollback to last good checkpoint; log with sufficient context; do not corrupt timeline.
- Invariants:
  - Layer IDs unique, order list matches layers map, selection ⊆ existing IDs.


## Testing
- Property tests: do(); undo() returns to identical state; do(); undo(); redo() yields original post-do state.
- Fuzz across random command sequences respecting invariants.
- Determinism: reapply history from empty doc equals current doc.
- Performance: benchmark large docs and long brush strokes under budget.
- Implementation steps
- Define EditorState schema and invariants; split canonical vs ephemeral.


## Implement HistoryManager with transactions, coalescing, memory limits, and checkpoints.
1. Define EditorState schema and invariants; split canonical vs ephemeral.
2. Implement HistoryManager with transactions, coalescing, memory limits, and checkpoints.
3. Convert all mutations to commands; adapt tools to emit transactions.
4. Wire canvas renderer to read from EditorState only; add overlay for previews.
5. Add persistence: serialize state + diffs with versioning and migrations.
6. Add keyboard shortcuts and minimal history UI.
7. Add tests for invertibility, determinism, and performance.

Short status update: Proposed a command-based, transactional undo/redo design covering layers, canvas, and tools with full state restoration, coalescing, and persistence. Ready to map this to your current modules when you’re ready.

- Command-driven history with transactions and coalescing for all edits (layers, canvas, tools).
- Single source of truth EditorState; renderer derives z-order from layers.order.
- Diff-based storage with memory limits, checkpoints, and full serialization for restore.
- Tools emit commands; previews are ephemeral and committed on interaction end.
- Deterministic, testable, and performant with clear UX semantics for undo/redo.
