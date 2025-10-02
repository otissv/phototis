import type { FBOManager } from "@/lib/renderer/fbo-manager.renderer"
import type { ShaderManager } from "@/lib/shaders/manager.shader"
import type { ChannelBindings } from "@/lib/shaders/types.shader"

export interface WorkerPassInvocation {
  shaderName: string
  variantKey?: string
  passId?: string
  uniforms?: Record<string, unknown>
  channels?: ChannelBindings
  targetFboName?: string
}

export class WorkerPassGraphPipeline {
  constructor(
    private gl: WebGL2RenderingContext,
    private fbo: FBOManager,
    private manager: ShaderManager
  ) {}

  runSingle(
    pass: WorkerPassInvocation,
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

    const fboName = pass.targetFboName || "pg-tmp"
    const target =
      this.fbo.getFBO(fboName) || this.fbo.createFBO(width, height, fboName)
    if (!target) return null
    this.fbo.bindFBO(fboName)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
    gl.useProgram(program)

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
    const prevLoc = gl.getUniformLocation(program, "u_previousPass")
    if (prevLoc && (pass.channels as any)?.u_previousPass) {
      gl.uniform1i(prevLoc, 0)
    }

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

    for (const [key, value] of Object.entries(pass.uniforms || {})) {
      const loc = gl.getUniformLocation(program, key)
      if (!loc) continue
      if (typeof value === "number") {
        if (key === "u_solidEnabled" || key === "u_colorizePreserveLum")
          gl.uniform1i(loc, (value as number) | 0)
        else gl.uniform1f(loc, value)
      } else if (Array.isArray(value)) {
        if (value.length === 2)
          gl.uniform2f(loc, value[0] as number, value[1] as number)
        else if (value.length === 3)
          gl.uniform3f(
            loc,
            value[0] as number,
            value[1] as number,
            value[2] as number
          )
        else if (value.length === 4)
          gl.uniform4f(
            loc,
            value[0] as number,
            value[1] as number,
            value[2] as number,
            value[3] as number
          )
        else if (value.length === 9) {
          gl.uniformMatrix3fv(loc, false, new Float32Array(value as number[]))
        } else if (value.length === 16) {
          gl.uniformMatrix4fv(loc, false, new Float32Array(value as number[]))
        }
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return target.texture
  }

  runDAG(
    passes: WorkerPassInvocation[],
    width: number,
    height: number,
    attribs: { position: WebGLBuffer; texcoord: WebGLBuffer }
  ): WebGLTexture | null {
    const idToPass = new Map<string, WorkerPassInvocation>()
    const deps = new Map<string, Set<string>>()
    const dependents = new Map<string, Set<string>>()
    const roots: string[] = []
    for (const pass of passes) {
      const id = pass.passId || pass.shaderName
      idToPass.set(id, pass)
      const ins = (pass as any)?.inputs as string[] | undefined
      if (ins?.length) {
        deps.set(id, new Set(ins))
        for (const dep of ins) {
          if (!dependents.has(dep)) dependents.set(dep, new Set())
          const depSet = dependents.get(dep)
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
      for (const dep of dependents.get(id) || []) {
        const s = deps.get(dep)
        if (!s) continue
        s.delete(id)
        if (s.size === 0) queue.push(dep)
      }
    }
    let last: WebGLTexture | null = null
    for (const id of topo) {
      const pass = idToPass.get(id) as WorkerPassInvocation
      if (last)
        pass.channels = { ...(pass.channels || {}), u_previousPass: last }
      const out = this.runSingle(pass, width, height, attribs)
      if (!out) return last
      last = out
    }
    return last
  }
}
