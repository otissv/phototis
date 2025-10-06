import {
  GlobalShaderRegistry,
  type ShaderRegistry,
} from "@/lib/shaders/registry.shader"
import { HybridRuntime } from "@/lib/renderer/hybrid-runtime.renderer"
import { WorkerRuntime } from "@/lib/renderer/worker-runtime.renderer"
import type {
  RuntimeInterface,
  ShaderDescriptor,
  ShaderMode,
} from "@/lib/shaders/types.shader"
import { CompositorShader } from "@/lib/shaders/passes/compositor.shader-descriptor"
import { CopyShader } from "@/lib/shaders/passes/copy.shader-descriptor"
import { LinearizeShader } from "@/lib/shaders/passes/linearize.shader-descriptor"
import { EncodeShader } from "@/lib/shaders/passes/encode.shader-descriptor"
import { LayerRenderShader } from "@/lib/shaders/passes/layer.render.shader-descriptor"
export class ShaderManager {
  private gl: WebGL2RenderingContext | null = null
  private activeMode: ShaderMode = "hybrid"
  private registry: ShaderRegistry
  private hybridRuntime: RuntimeInterface
  private workerRuntime: RuntimeInterface
  private activeRuntime: RuntimeInterface

  constructor(registry: ShaderRegistry = GlobalShaderRegistry) {
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

    this.registry.register(LinearizeShader)
    this.registry.register(CompositorShader)
    this.registry.register(EncodeShader)
    this.registry.register(CopyShader)
    this.registry.register(LayerRenderShader)
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

  getRegistry(): ShaderRegistry {
    return this.registry
  }
}
