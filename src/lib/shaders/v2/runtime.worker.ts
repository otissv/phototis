import type {
  CompiledProgramHandle,
  RuntimeCompileRequest,
  RuntimeInterface,
  ShaderDescriptor,
} from "./types"

// This file provides a stub interface for the main thread. Actual compilation happens in the worker.

export class WorkerRuntime implements RuntimeInterface {
  // In the worker we will have a similar cache keyed per shader/variant/pass.
  // On the main thread, calls are proxied via IPC; cache here is only to avoid duplicate messages.
  private gl: WebGL2RenderingContext | null = null
  private cache: Map<string, CompiledProgramHandle> = new Map()

  initialize(gl: WebGL2RenderingContext): void {
    this.gl = gl
  }

  private key(req: RuntimeCompileRequest): string {
    const pass = req.passId ? `::${req.passId}` : ""
    const variant = req.variantKey ? `::${req.variantKey}` : ""
    return `${req.shader.name}@${req.shader.version}${pass}${variant}`
  }

  getOrCompileProgram(
    _req: RuntimeCompileRequest
  ): CompiledProgramHandle | null {
    // In worker mode, the worker owns the GL context and compiled programs.
    // The main thread should not request programs; pipelines running in worker use the runtime there.
    return null
  }

  warmPrograms(_shaders: ShaderDescriptor[], _mode: "hybrid" | "worker"): void {
    // No-op on main thread. The worker runtime warmup happens inside the worker.
  }

  clear(): void {
    // Nothing to clear on main thread for worker runtime
    this.cache.clear()
  }
}
