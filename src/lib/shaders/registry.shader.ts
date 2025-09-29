import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

export class ShaderRegistryV2 {
  private descriptors: Map<string, ShaderDescriptor> = new Map()
  private versionCounter = 1

  register(descriptor: ShaderDescriptor): void {
    this.descriptors.set(descriptor.name, descriptor)
  }

  get(name: string): ShaderDescriptor | undefined {
    return this.descriptors.get(name)
  }

  getAll(): ShaderDescriptor[] {
    return Array.from(this.descriptors.values())
  }

  getVersion(): number {
    return this.versionCounter
  }

  bumpVersion(): void {
    this.versionCounter++
  }

  replaceAll(descriptors: ShaderDescriptor[]): void {
    this.descriptors.clear()
    for (const d of descriptors) this.descriptors.set(d.name, d)
    this.bumpVersion()
  }
}

export const GlobalShaderRegistryV2 = new ShaderRegistryV2()
