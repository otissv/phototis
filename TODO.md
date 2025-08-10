Not fully implemented / missing
HybridRenderer in worker: HybridRenderer currently runs only on the main thread fallback. It’s not ported to OffscreenCanvas/worker, so code paths diverge.
Multi-worker model: only a single render worker exists. No dedicated Filter Worker or Compositing Worker queues.
Progressive rendering UX: staged low→high resolution previews aren’t guaranteed to present incrementally; level scheduling/cancellation and display handoff need tightening.
Adaptive quality scaling: no dynamic quality selection based on frame time/GPU memory/interaction patterns.
Shader management across threads: worker compiles shaders inline; there’s no shared ShaderManager, shader pooling, or cross-task program cache.
State sync/dedup: no versioned task tokens keyed by a layersSignature; minimal coalescing; worker discards aren’t guaranteed for stale tasks.
Resource pooling/eviction: texture/FBO caching exists but lacks robust LRU thresholds and memory pressure responses.
Efficient serialization: layer/image transfer is basic; there’s no binary packing or structured clone size control for large layer graphs.
Error recovery: retries exist, but no graceful CPU fallback or state replay; limited user-facing degradation flow.
Security completeness: filter kernel and size clamping should be enforced at both main-thread validation and worker uniform assignment; ensure strict caps against MAX_* constants everywhere.

Security items to close
Enforce clamp of blur/filters at worker uniform binding.
Validate uploaded image dimensions against MAX_TEXTURE_SIZE/MAX_CANVAS_DIMENSION prior to queueing tasks.
Impact
Smooth, non-blocking editing under heavy load; consistent visuals across worker/hybrid paths; safer GPU usage; groundwork for multi-worker scalability.

1. Can implement together now (independent, low coupling)
- Port HybridRenderer to worker + Shared ShaderManager: Move HybridRenderer into the render worker and use a shared ShaderManager (module shared by main/worker) to compile/cache programs per GLSL signature. Minimal coupling with other items.
- Expand pooling (Texture/FBO LRU + telemetry): Implement LRU with size ceilings and periodic eviction; expose pool stats. Can be done alongside shader unification.
- Harden security (dimension/blur clamps on both ends): Enforce clamps before allocations and at uniform binding in the worker. Straightforward and independent.


2. Task lifecycle and robustness (good to do together)
- layersSignature token/version + worker stale-task drop: Add a version field to messages; worker ignores outdated tasks. Pair with…
- Main-thread task coalescing + improved error handling: Coalesce rapid updates; add structured error codes and retry backoff. These form one cohesive “lifecycle” upgrade.

3. Rendering quality pipeline (progressive + adaptive)
- True progressive rendering (0.25 → 0.5 → 1.0 with preemption/cancel): Schedule level tasks with cancellation; present each level as it completes on OffscreenCanvas.
- Adaptive quality (frame-time/memory aware): Build on the progressive pipeline’s metrics; adjust level selection and blur taps during interaction, restore quality on idle.
- These two can proceed in parallel once basic task tokening is in place; adaptive piggybacks on progressive telemetry.
  
4. Worker topology and transfer optimization
- Split queues/workers (Render + Filter [+ Compositing if needed]): Introduce a dedicated Filter Worker for heavy kernels.
- Optimize transfer (ImageBitmap, transferable buffers, compact serialization): Implement alongside the Filter Worker; they reinforce each other but don’t block other groups.

Quick wins
Add task tokening with layersSignature and worker-side stale-task drops.
Share GLSL sources via a ShaderManager module used by both main and worker; cache compiled programs.
Implement progressive level scheduling with cancellation and immediate present per-level in the worker.


