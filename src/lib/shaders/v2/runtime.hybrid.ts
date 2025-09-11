import type {
  CompiledProgramHandle,
  RuntimeCompileRequest,
  RuntimeInterface,
  ShaderDescriptor,
} from "./types"

function withDefines(
  source: string,
  defines?: Record<string, string | number | boolean>
): string {
  if (!defines || Object.keys(defines).length === 0) return source
  const lines: string[] = []
  for (const [key, val] of Object.entries(defines)) {
    if (typeof val === "boolean") {
      if (val) lines.push(`#define ${key}`)
    } else {
      lines.push(`#define ${key} ${String(val)}`)
    }
  }
  if (lines.length === 0) return source
  return `${lines.join("\n")}\n${source}`
}

export class HybridRuntime implements RuntimeInterface {
  private gl: WebGL2RenderingContext | null = null
  private cache: Map<string, CompiledProgramHandle> = new Map()

  initialize(gl: WebGL2RenderingContext): void {
    this.gl = gl
  }

  private makeKey(req: RuntimeCompileRequest): string {
    const pass = req.passId ? `::${req.passId}` : ""
    const variant = req.variantKey ? `::${req.variantKey}` : ""
    return `${req.shader.name}@${req.shader.version}${pass}${variant}`
  }

  getOrCompileProgram(
    req: RuntimeCompileRequest
  ): CompiledProgramHandle | null {
    if (!this.gl) return null
    const key = this.makeKey(req)
    const cached = this.cache.get(key)
    if (cached) return cached
    const handle = this.compile(req.shader, req.variantKey, req.passId)
    if (handle) this.cache.set(key, handle)
    return handle
  }

  warmPrograms(shaders: ShaderDescriptor[], _mode: "hybrid" | "worker"): void {
    for (const shader of shaders) {
      // eager single-pass
      if (!shader.passes && shader.sources?.fragment) {
        void this.getOrCompileProgram({ shader })
      }
      // eager for each pass
      if (shader.passes) {
        for (const pass of shader.passes) {
          void this.getOrCompileProgram({ shader, passId: pass.id })
        }
      }
    }
  }

  clear(): void {
    if (!this.gl) {
      this.cache.clear()
      return
    }
    for (const handle of this.cache.values()) {
      try {
        this.gl.deleteProgram(handle.program)
      } catch {}
    }
    this.cache.clear()
  }

  private compile(
    shader: ShaderDescriptor,
    variantKey?: string,
    passId?: string
  ): CompiledProgramHandle | null {
    if (!this.gl) return null
    const gl = this.gl
    const defineMap: Record<string, string | number | boolean> = {
      ...(shader.defines || {}),
    }
    if (variantKey && shader.variants) {
      const v = shader.variants.find((vv) => vv.key === variantKey)
      if (v?.defines) Object.assign(defineMap, v.defines)
    }

    let vertexSource =
      shader.sources?.vertex ||
      `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }`
    let fragmentSource = shader.sources?.fragment || ""
    if (shader.passes && passId) {
      const pass = shader.passes.find((p) => p.id === passId)
      if (!pass) return null
      if (pass.vertexSource) vertexSource = pass.vertexSource
      fragmentSource = pass.fragmentSource
    }

    const vs = gl.createShader(gl.VERTEX_SHADER)
    if (!vs) return null
    gl.shaderSource(vs, withDefines(vertexSource, defineMap))
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vs) || "Unknown vertex compile error"
      const src = withDefines(vertexSource, defineMap)
      const excerpt = src.split("\n").slice(0, 60).join("\n")
      console.error("Vertex shader compilation failed:", {
        shader: shader.name,
        variant: variantKey || "default",
        pass: passId || "single",
        info,
        excerpt,
      })
      gl.deleteShader(vs)
      return null
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fs) {
      gl.deleteShader(vs)
      return null
    }
    gl.shaderSource(fs, withDefines(fragmentSource, defineMap))
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fs) || "Unknown fragment compile error"
      const src = withDefines(fragmentSource, defineMap)
      const excerpt = src.split("\n").slice(0, 120).join("\n")
      console.error("Fragment shader compilation failed:", {
        shader: shader.name,
        variant: variantKey || "default",
        pass: passId || "single",
        info,
        excerpt,
      })
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return null
    }

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      return null
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Unknown program link error"
      console.error("Program linking failed:", {
        shader: shader.name,
        variant: variantKey || "default",
        pass: passId || "single",
        info,
      })
      gl.deleteProgram(program)
      return null
    }

    // Cache uniform locations lazily on demand
    return {
      program,
      uniformLocations: new Map(),
    }
  }
}
