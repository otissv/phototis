export interface ShaderUniforms {
  [key: string]: number | boolean | [number, number] | null
}

export interface ShaderPlugin {
  name: string
  vertexShader: string
  fragmentShader: string
  uniforms: ShaderUniforms
  updateUniforms?(values: any): void
}

export abstract class BaseShaderPlugin implements ShaderPlugin {
  abstract name: string
  abstract vertexShader: string
  abstract fragmentShader: string
  abstract uniforms: ShaderUniforms

  updateUniforms?(values: any): void {
    // Default implementation - override in subclasses if needed
  }
} 