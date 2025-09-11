export type ShaderMode = "hybrid" | "worker"

export type ChannelSemantic =
  | "currentLayer"
  | "previousPass"
  | "mask"
  | "lut3d"
  | "custom0"
  | "custom1"
  | "custom2"
  | "custom3"

export type CompilePolicy = "eager" | "lazy" | "warm"

export interface ShaderVariantDescriptor {
  key: string // stable key string for this variant
  defines?: Record<string, string | number | boolean>
}

export interface ShaderPassDescriptor {
  id: string
  vertexSource?: string
  fragmentSource: string
  channels?: (
    | { name: string; semantic: ChannelSemantic }
    | { name: string; semantic: ChannelSemantic; optional?: boolean }
  )[]
  uniforms?: Record<string, unknown>
  // IDs of passes this pass depends on; if empty, depends on previous output
  inputs?: string[]
}

export interface ShaderDescriptor {
  name: string
  version: string
  sources?: {
    vertex?: string
    fragment?: string
  }
  defines?: Record<string, string | number | boolean>
  uniforms?: Record<string, unknown>
  channels?: { name: string; semantic: ChannelSemantic }[]
  variants?: ShaderVariantDescriptor[]
  defaults?: Record<string, unknown>
  ui?: unknown
  policies?: Partial<Record<ShaderMode, CompilePolicy>>
  // If provided, this shader is multi-pass; otherwise single-pass using sources
  passes?: ShaderPassDescriptor[]
}

export interface CompiledProgramHandle {
  program: WebGLProgram
  uniformLocations: Map<string, WebGLUniformLocation | null>
}

export interface RuntimeCompileRequest {
  shader: ShaderDescriptor
  variantKey?: string
  passId?: string
}

export interface RuntimeInterface {
  initialize(gl: WebGL2RenderingContext): void
  getOrCompileProgram(req: RuntimeCompileRequest): CompiledProgramHandle | null
  warmPrograms(shaders: ShaderDescriptor[], mode: ShaderMode): void
  clear(): void
}

export interface PassExecutionContext {
  gl: WebGL2RenderingContext
  width: number
  height: number
}

export type ChannelBindings = Record<string, WebGLTexture | null>
