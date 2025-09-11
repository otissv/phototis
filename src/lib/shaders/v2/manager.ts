import { GlobalShaderRegistryV2, type ShaderRegistryV2 } from "./registry"
import { HybridRuntime } from "./runtime.hybrid"
import { WorkerRuntime } from "./runtime.worker"
import type { RuntimeInterface, ShaderDescriptor, ShaderMode } from "./types"

export class ShaderManagerV2 {
  private gl: WebGL2RenderingContext | null = null
  private activeMode: ShaderMode = "hybrid"
  private registry: ShaderRegistryV2
  private hybridRuntime: RuntimeInterface
  private workerRuntime: RuntimeInterface
  private activeRuntime: RuntimeInterface

  constructor(registry: ShaderRegistryV2 = GlobalShaderRegistryV2) {
    this.registry = registry
    this.hybridRuntime = new HybridRuntime()
    this.workerRuntime = new WorkerRuntime()
    this.activeRuntime = this.hybridRuntime
  }

  initialize(gl: WebGL2RenderingContext, mode: ShaderMode = "hybrid"): void {
    this.gl = gl
    this.hybridRuntime.initialize(gl)
    this.workerRuntime.initialize(gl)
    this.activeMode = mode
    this.activeRuntime =
      mode === "hybrid" ? this.hybridRuntime : this.workerRuntime
  }

  registerShader(descriptor: ShaderDescriptor): void {
    this.registry.register(descriptor)
    this.registry.bumpVersion()
  }

  getShader(name: string, variantKey?: string): ShaderDescriptor | undefined {
    const shader = this.registry.get(name)
    if (!shader) return undefined
    // Optionally validate variant here
    if (variantKey && shader.variants) {
      const exists = shader.variants.some((v) => v.key === variantKey)
      if (!exists) return undefined
    }
    return shader
  }

  prepareForMode(nextMode: ShaderMode, _docState: unknown): void {
    // Decide pre-warm set based on policy
    const shaders = this.registry.getAll()
    const eager = shaders.filter(
      (s) => (s.policies?.[nextMode] ?? "eager") === "eager"
    )
    const warm = shaders.filter(
      (s) => (s.policies?.[nextMode] ?? "eager") === "warm"
    )

    const rt = nextMode === "hybrid" ? this.hybridRuntime : this.workerRuntime
    rt.warmPrograms(eager, nextMode)
    // warm can be compiled on first use; optional: queue a microtask to warm gradually
    void warm
    // Worker IPC to prepare will be triggered by the caller (canvas/manager layer)
  }

  setMode(nextMode: ShaderMode): void {
    this.activeMode = nextMode
    this.activeRuntime =
      nextMode === "hybrid" ? this.hybridRuntime : this.workerRuntime
  }

  cleanup(_mode?: ShaderMode): void {
    this.hybridRuntime.clear()
    this.workerRuntime.clear()
  }

  getActiveRuntime(): RuntimeInterface {
    return this.activeRuntime
  }

  getRegistry(): ShaderRegistryV2 {
    return this.registry
  }
}
