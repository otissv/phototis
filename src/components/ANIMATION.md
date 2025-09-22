

**Goal**
Replace all tool/filter “static” parameters with a unified keyframe system. At any time `t`, the editor samples parameter values from keyframes (with easing/interpolation) and feeds them through the existing render pipeline (worker/hybrid) and shader uniforms.

**Scope**

* Files to update end-to-end: `tools-state.tsx`, `tools.ts`, `context.tsx`, `image-editor.tsx`, `canvas.image-editor.tsx`, `hybrid-renderer.ts`, `shader-manager.ts`, `render-worker.ts`, `asynchronous-pipeline.ts`, `blend-plugins.ts`, `color-adjustments.ts`, `blur-effects.ts`, `fbo-manager.ts`, `render-config.ts`, `types.blend.ts`.
* Remove all legacy “static value” usage; no fallbacks.
* Fully implement the keyframe system end-to-end.

**Data Model**

* Define canonical types for: Timeline, Track (per tool parameter), Keyframe (time, value, easing, interpolation, optional tangent/handle data), and Framerate/Timebase.
* Each adjustment/effect parameter becomes a **Track** with ≥1 **Keyframe**. The first keyframe (t=0) equals the previous default static value.
* Support parameter kinds: scalar, vector2/3/4, boolean (stepped), enum (stepped), color (RGBA with linearized interpolation), angles (shortest-arc), percentages, and ranges with constraints.

**Sampling Engine**

* Implement a pure function to sample a parameter at time `t`: neighbor keyframe search, easing, and interpolation per parameter kind.
* Easing: linear, easeIn, easeOut, easeInOut, cubic bezier; stepped for discrete params.
* Color: interpolate in linear float space, not sRGB.
* Clamp to parameter domain after interpolation.

**Integration Points**

* **EditorContext**: canonical `playheadTime` + timeline state; ephemeral scrubbing state; undo/redo integration for keyframe edits.
* **Tools state**: replace `value` fields with `track` (keyframes).
* **UI**: sliders scrub the current time’s sampled value; editing the value writes/updates a keyframe at `playheadTime`. Add add/delete keyframe actions (no timeline UI buildout required now).
* **History/Autosave**: serialize/deserialize timelines; thumbnails taken at current `playheadTime`.
* **Worker/Renderer**: render loop receives `playheadTime`; before each pass, sample all active parameter tracks and send uniforms/params.
* **ShaderManager/HybridRenderer**: no shader changes; only input values now come from sampled params.
* **Performance**: memoize sampling per (layerId, toolId, paramId, t); invalidate on keyframe edits. Keep sampling O(log n) via binary search.

**Behaviors**

* New tool/adjustment: auto-create a first keyframe at t=0 with its prior default.
* Deleting all but one keyframe preserves that single keyframe at t=0.
* Booleans/enums are stepped; vectors/colors interpolate component-wise; angles shortest path.

**Persistence**
* Ensure deterministic export/import.

**Testing & Acceptance**

* Sampling correctness: edge cases at segment boundaries, before first/after last keyframe.
* Color linearization tested with round-trip vs sRGB.
* Playhead scrubbing updates canvas in real time without dropped frames.
* Undo/redo for add/move/delete keyframe and easing changes.
* Worker messages contain only sampled values, never tracks.
* No references to legacy static params remain across listed files.
