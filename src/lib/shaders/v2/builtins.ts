import { GlobalShaderRegistryV2, type ShaderRegistryV2 } from "./registry"
import { CompositorShader } from "./passes/compositor"
import { CopyShader } from "./passes/copy"
import { LinearizeShader } from "./passes/linearize"
import { EncodeShader } from "./passes/encode"
import { LayerRenderShader } from "./passes/layer.render"
import { AdjustmentsBasicDescriptor } from "./plugins/adjustments"
import { BlurSeparableDescriptor } from "./plugins/blur"
import { VintageDescriptor } from "./plugins/vintage"

export function registerBuiltinShaders(
  registry: ShaderRegistryV2 = GlobalShaderRegistryV2
): void {
  registry.register(LinearizeShader)
  registry.register(CompositorShader)
  registry.register(EncodeShader)
  registry.register(CopyShader)
  registry.register(LayerRenderShader)
  registry.register(AdjustmentsBasicDescriptor)
  registry.register(BlurSeparableDescriptor)
  registry.register(VintageDescriptor)
}
