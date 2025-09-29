import {
  GlobalShaderRegistryV2,
  type ShaderRegistryV2,
} from "@/lib/shaders/registry.shader"
import { CompositorShader } from "@/lib/shaders/passes/compositor.shader-descriptor"
import { CopyShader } from "@/lib/shaders/passes/copy.shader-descriptor"
import { LinearizeShader } from "@/lib/shaders/passes/linearize.shader-descriptor"
import { EncodeShader } from "@/lib/shaders/passes/encode.shader-descriptor"
import { LayerRenderShader } from "@/lib/shaders/passes/layer.render.shader-descriptor"
import { AdjustmentsBasicDescriptor } from "@/lib/shaders/plugins/adjustments.shader-descriptor"
import { BlurSeparableDescriptor } from "@/lib/shaders/plugins/blur.shader-descriptor"
import { VintageDescriptor } from "@/lib/shaders/plugins/vintage.shader-descriptor"

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
