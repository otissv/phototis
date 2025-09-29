Has plugin-based ShaderManager + rendering pipelines (breaking change) with hybrid & worker support been fully implemented?
Is there any thong missing?

Specific Requirements:
Goal
Replace the current monolithic shader flow with a plugin-oriented ShaderManager and pass-graph rendering pipelines that run identically in Hybrid (main thread) and Worker (OffscreenCanvas) modes. This is not backward compatible—update all affected files.and remove all legacy code.

Deliverables

Shader Registry (pure descriptors): name, version, sources, uniforms, channels, defines, variants, defaults, ui, policies { hybrid|worker: eager|lazy|warm }, optional multi-pass passes DAG.

Shader Runtimes (two caches): HybridRuntime and WorkerRuntime, each compiling/caching programs from the shared registry; no program sharing across modes.

ShaderManager Facade: initialize, registerShader, getShader(name, variantKey?), prepareForMode(nextMode, docState), cleanup(mode?). Routes calls to the active runtime; syncs registry to worker.

Rendering Pipelines (Hybrid + Worker) with pass-graph:

Convert visible adjustment layers into ordered passes reading prior FBO → writing next FBO.

Support multi-pass plugins (DAG execution, ping-pong FBOs).

Keep compositing/blend modes/masks in a dedicated compositor pass.

Enforce no read/write feedback; fix ping-pong and FBO hygiene.

Channel binding contract: plugins declare u_channel0..3 semantics (e.g., currentLayer, mask, previousPass, lut3d). Pipelines bind concrete textures per spec.

Uniform convention (frozen): built-ins (u_texture, u_resolution, u_opacity, u_time, u_frame, u_randomSeed, u_colorSpace, u_texelSize, u_transform) + u_<param> for effect parameters.

Mode switch handshake: freeze submissions → prepareForMode(nextMode, visibleLayerStack) pre-warms required programs per policy → flip mode → render.

Worker IPC updates: versioned messages carry effect IDs, parameters, channels, variant keys, and pass graphs; lazy compile supported; context-loss recovery.

Color pipeline: linearize → effect passes → composite (blend/mask) → encode; identical in both modes.

Migration: convert all existing effects into registered plugins; register base copy, composite, blend helpers. Remove all legacy single-program assumptions.

Policies & Behavior

Per-mode compile policy: eager for core passes; lazy/warm for optional or variant-heavy effects.

Deterministic outputs and parity across modes.

Robust error handling: compile/link errors logged with shader name/variant and source excerpt; pass skipped without crashing.

Context-loss rebuild from registry in both runtimes.

Acceptance Criteria

All effects run via getShader(name[, variantKey]) in both hybrid and worker pipelines.

Adjustment layers and multi-pass plugins execute as pass graphs with correct channel bindings.

Full blend mode parity and mask handling in compositor; no illegal feedback warnings.

Real-time parameter updates during drags; progressive/preview quality preserved.

Mode switches are smooth after prepareForMode; visual parity between modes.

No legacy single-program API remains; all updated files compile and run with the new system.
