import type { FBOManager } from "../fbo-manager"
import type { ShaderManagerV2 } from "./manager"
import type { ChannelBindings } from "./types"

export interface PassInvocation {
  shaderName: string
  variantKey?: string
  passId?: string
  uniforms?: Record<string, unknown>
  channels?: ChannelBindings
  targetFboName?: string
}

export class HybridPassGraphPipeline {
  constructor(
    private gl: WebGL2RenderingContext,
    private fbo: FBOManager,
    private manager: ShaderManagerV2
  ) {}

  runSingle(
    pass: PassInvocation,
    width: number,
    height: number,
    attribs?: { position: WebGLBuffer; texcoord: WebGLBuffer }
  ): WebGLTexture | null {
    const shader = this.manager.getShader(pass.shaderName)
    if (!shader) return null
    const rt = this.manager.getActiveRuntime()
    const handle = rt.getOrCompileProgram({
      shader,
      variantKey: pass.variantKey,
      passId: pass.passId,
    })
    if (!handle) return null
    const program = handle.program
    const gl = this.gl

    // Output target
    const fboName = pass.targetFboName || "pg-tmp"
    const target =
      this.fbo.getFBO(fboName) || this.fbo.createFBO(width, height, fboName)
    if (!target) return null
    this.fbo.bindFBO(fboName)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    // Attributes: bind explicit buffers if provided
    const posLoc = gl.getAttribLocation(program, "a_position")
    const uvLoc = gl.getAttribLocation(program, "a_texCoord")
    if (attribs?.position) {
      gl.bindBuffer(gl.ARRAY_BUFFER, attribs.position)
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc)
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
      }
    }
    if (attribs?.texcoord) {
      gl.bindBuffer(gl.ARRAY_BUFFER, attribs.texcoord)
      if (uvLoc >= 0) {
        gl.enableVertexAttribArray(uvLoc)
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0)
      }
    }
    // Bind channels by convention
    let unit = 0
    for (const [key, tex] of Object.entries(pass.channels || {})) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex ?? null)
      const loc = gl.getUniformLocation(program, key)
      if (loc) gl.uniform1i(loc, unit)
      unit++
    }
    // Channel aliases: u_channel0..3 map to the first four bound samplers
    for (let i = 0; i < Math.min(unit, 4); i++) {
      const aliasLoc = gl.getUniformLocation(program, `u_channel${i}`)
      if (aliasLoc) gl.uniform1i(aliasLoc, i)
    }
    // Common channel aliases
    const prevLoc = gl.getUniformLocation(program, "u_previousPass")
    if (prevLoc && (pass.channels as any)?.u_previousPass) {
      gl.uniform1i(prevLoc, 0) // assume bound at 0 when supplied
    }

    // Built-in uniforms
    const res = gl.getUniformLocation(program, "u_resolution")
    if (res) gl.uniform2f(res, width, height)
    const time = gl.getUniformLocation(program, "u_time")
    if (time) gl.uniform1f(time, performance.now() / 1000)
    const frame = gl.getUniformLocation(program, "u_frame")
    if (frame) gl.uniform1f(frame, (performance.now() / 16.67) % 1e6)
    const seed = gl.getUniformLocation(program, "u_randomSeed")
    if (seed) gl.uniform1f(seed, Math.random())
    const texel = gl.getUniformLocation(program, "u_texelSize")
    if (texel)
      gl.uniform2f(texel, 1 / Math.max(1, width), 1 / Math.max(1, height))

    // Custom uniforms
    for (const [k, v] of Object.entries(pass.uniforms || {})) {
      const loc = gl.getUniformLocation(program, k)
      if (!loc) continue
      if (typeof v === "number") gl.uniform1f(loc, v)
      else if (Array.isArray(v)) {
        if (v.length === 2) gl.uniform2f(loc, v[0] as number, v[1] as number)
        else if (v.length === 3)
          gl.uniform3f(loc, v[0] as number, v[1] as number, v[2] as number)
        else if (v.length === 4)
          gl.uniform4f(
            loc,
            v[0] as number,
            v[1] as number,
            v[2] as number,
            v[3] as number
          )
        else if (v.length === 9) {
          gl.uniformMatrix3fv(loc, false, new Float32Array(v as number[]))
        } else if (v.length === 16) {
          gl.uniformMatrix4fv(loc, false, new Float32Array(v as number[]))
        }
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return target.texture
  }

  runDAG(
    passes: PassInvocation[],
    width: number,
    height: number,
    attribs: { position: WebGLBuffer; texcoord: WebGLBuffer }
  ): WebGLTexture | null {
    // Topological order by inputs
    const idToPass = new Map<string, PassInvocation>()
    const deps = new Map<string, Set<string>>()
    const dependents = new Map<string, Set<string>>()
    const roots: string[] = []
    for (const p of passes) {
      const id = p.passId || p.shaderName
      idToPass.set(id, p)
      const ins = (p as any)?.inputs as string[] | undefined
      if (ins?.length) {
        deps.set(id, new Set(ins))
        for (const i of ins) {
          if (!dependents.has(i)) dependents.set(i, new Set())
          const depSet = dependents.get(i)
          if (depSet) depSet.add(id)
        }
      } else {
        deps.set(id, new Set())
        roots.push(id)
      }
    }
    const queue: string[] = [...roots]
    const topo: string[] = []
    while (queue.length) {
      const id = queue.shift() as string
      topo.push(id)
      for (const d of dependents.get(id) || []) {
        const s = deps.get(d)
        if (!s) continue
        s.delete(id)
        if (s.size === 0) queue.push(d)
      }
    }
    if (topo.length < idToPass.size) {
      try {
        // Log cycle or missing dependency; execute only resolved subset
        // eslint-disable-next-line no-console
        console.warn(
          "Pass DAG contains cycles or missing inputs; executing resolved subset",
          {
            resolved: topo.length,
            total: idToPass.size,
          }
        )
      } catch {}
    }
    let last: WebGLTexture | null = null
    for (const id of topo) {
      const p = idToPass.get(id) as PassInvocation
      if (last) p.channels = { ...(p.channels || {}), u_previousPass: last }
      const out = this.runSingle(p, width, height, attribs)
      if (!out) return last
      last = out
    }
    return last
  }
}
