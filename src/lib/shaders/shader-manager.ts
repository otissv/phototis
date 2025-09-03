import { VertexShaderPlugin } from "./vertex-shader"
import { ColorAdjustmentsPlugin } from "./color-adjustments"
import { BlurEffectsPlugin } from "./blur-effects"
import { VintageEffectsPlugin } from "./vintage-effects"
import type { ShaderPlugin, ShaderUniforms } from "./base-shader"

export class ShaderManager {
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private plugins: ShaderPlugin[] = []
  private uniformLocations: Map<string, WebGLUniformLocation | null> = new Map()
  private lastUniformValues: Map<string, any> = new Map()

  constructor() {
    // Initialize all plugins
    this.plugins = [
      new VertexShaderPlugin(),
      new ColorAdjustmentsPlugin(),
      new BlurEffectsPlugin(),
      new VintageEffectsPlugin(),
    ]
  }

  initialize(gl: WebGL2RenderingContext): boolean {
    this.gl = gl
    this.uniformLocations.clear()
    this.lastUniformValues.clear()
    return this.compileProgram()
  }

  private compileProgram(): boolean {
    if (!this.gl) return false

    // Detect WebGL version for GLSL generation
    const isWebGL2 = !!(this.gl as any).bindVertexArray // simple heuristic

    // Combine all vertex shaders (use the first one as base)
    const baseVertexShader = this.plugins[0].vertexShader

    // Combine all fragment shaders
    const fragmentShaders = this.plugins.map((plugin) => plugin.fragmentShader)
    const combinedFragmentShader = this.combineFragmentShaders(fragmentShaders, isWebGL2)

    // Create and compile vertex shader
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)
    if (!vertexShader) return false
    const vertexSource = isWebGL2
      ? this.upgradeVertexTo300es(baseVertexShader)
      : baseVertexShader
    this.gl.shaderSource(vertexShader, vertexSource)
    this.gl.compileShader(vertexShader)

    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Vertex shader compilation failed:",
        this.gl.getShaderInfoLog(vertexShader)
      )
      return false
    }

    // Create and compile fragment shader
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)
    if (!fragmentShader) return false
    this.gl.shaderSource(fragmentShader, combinedFragmentShader)
    this.gl.compileShader(fragmentShader)

    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Fragment shader compilation failed:",
        this.gl.getShaderInfoLog(fragmentShader)
      )
      return false
    }

    // Create and link program
    const program = this.gl.createProgram()
    if (!program) return false
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(
        "Program linking failed:",
        this.gl.getProgramInfoLog(program)
      )
      return false
    }

    this.program = program
    return true
  }

  private combineFragmentShaders(shaders: string[], isWebGL2: boolean = false): string {
    // Build header with #version first when WebGL2
    const header = isWebGL2
      ? "#version 300 es\nprecision highp float;\n"
      : "precision highp float;\n"

    let combined = header
    combined += (isWebGL2 ? "in vec2 v_texCoord;\n" : "varying vec2 v_texCoord;\n")
    combined += "uniform sampler2D u_image;\n"
    combined += "uniform vec2 u_resolution;\n"
    combined += "uniform float u_opacity;\n"
    combined += "// Solid fill uniforms\n"
    combined += "uniform int u_solidEnabled;\n"
    combined += "uniform vec3 u_solidColor;\n"
    combined += "uniform float u_solidAlpha;\n"
    combined += "// Recolor color (when recolor provided as color+amount)\n"
    combined += "uniform vec3 u_recolorColor;\n"
    combined += "// Affinity-style recolor uniforms\n"
    combined += "uniform float u_recolorHue;\n"
    combined += "uniform float u_recolorSaturation;\n"
    combined += "uniform float u_recolorLightness;\n"
    combined += "uniform int u_recolorPreserveLum;\n"
    combined += "uniform float u_recolorAmount;\n"
    if (isWebGL2) combined += "out vec4 outColor;\n"

    // Add all uniform declarations from all shaders (dedup)
    const uniformSet = new Set<string>()
    shaders.forEach((shader) => {
      const uniformMatches = shader.match(/uniform\s+\w+\s+\w+;/g)
      if (uniformMatches) {
        uniformMatches.forEach((uniform) => {
          if (
            !uniform.includes("u_image") &&
            !uniform.includes("u_resolution") &&
            !uniform.includes("u_opacity") &&
            !uniform.includes("v_texCoord")
          ) {
            uniformSet.add(uniform)
          }
        })
      }
    })

    uniformSet.forEach((uniform) => {
      combined += `${uniform}\n`
    })

    // Helper functions (compatible with GLSL 100/300 es)
    combined += `
vec3 rgb2hsv(vec3 c){
  vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y);
  float e=1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);
}
vec3 hsv2rgb(vec3 c){
  vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);
}
vec3 rgb2hsl(vec3 c){
  float r=c.r,g=c.g,b=c.b;float maxc=max(max(r,g),b);float minc=min(min(r,g),b);
  float l=(maxc+minc)*0.5;float h=0.0;float s=0.0; if(maxc!=minc){
    float d=maxc-minc; s=l>0.5?d/(2.0-maxc-minc):d/(maxc+minc);
    if(maxc==r){h=(g-b)/d+(g<b?6.0:0.0);} else if(maxc==g){h=(b-r)/d+2.0;} else {h=(r-g)/d+4.0;}
    h/=6.0; }
  return vec3(h,s,l);
}
float hue2rgb(float p,float q,float t){ if(t<0.0) t+=1.0; if(t>1.0) t-=1.0; if(t<1.0/6.0) return p+(q-p)*6.0*t; if(t<1.0/2.0) return q; if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
vec3 hsl2rgb(vec3 hsl){ float h=hsl.x; float s=hsl.y; float l=hsl.z; float r,g,b; if(s==0.0){ r=g=b=l; } else {
  float q=l<0.5? l*(1.0+s) : l + s - l*s; float p=2.0*l-q;
  r=hue2rgb(p,q,h+1.0/3.0); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1.0/3.0); } return vec3(r,g,b); }
float random(vec2 st){ return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123); }
`

    // Main
    combined += `
void main(){
  vec2 uv=v_texCoord;
  vec4 color=${isWebGL2 ? "texture(u_image, uv)" : "texture2D(u_image, uv)"};
  if(u_solidEnabled==1){ vec4 solidColor=vec4(u_solidColor,u_solidAlpha); color=solidColor; }
  ${isWebGL2 ? "outColor = color;" : "gl_FragColor = color;"}
}
`

    return combined
  }

  private upgradeVertexTo300es(source: string): string {
    // Transform attribute/varying to in/out and add version directive
    let s = source
    s = s.replace(/attribute\s+/g, "in ")
    s = s.replace(/varying\s+/g, "out ")
    // Insert #version 300 es at the top if not present
    if (!/^\s*#version\s+300\s+es/m.test(s)) {
      s = `#version 300 es\n${s}`
    }
    return s
  }

  getProgram(): WebGLProgram | null {
    return this.program
  }

  getAllUniforms(): ShaderUniforms {
    const allUniforms: ShaderUniforms = {}
    this.plugins.forEach((plugin) => {
      Object.assign(allUniforms, plugin.uniforms)
    })
    return allUniforms
  }

  updateUniforms(values: any): void {
    this.plugins.forEach((plugin) => {
      if (plugin.updateUniforms) {
        plugin.updateUniforms(values)
      }
    })

    // Capture extra recolor uniforms not owned by plugins
    const extras = [
      "u_recolorColor", // vec3 set elsewhere
      // Affinity-style recolor uniforms
      "u_recolorHue",
      "u_recolorSaturation",
      "u_recolorLightness",
      "u_recolorAmount",
      "u_recolorPreserveLum",
    ] as const

    // Map from tool keys to uniform names
    const toolToUniform: Record<string, string> = {
      u_recolorHue: "recolorHue",
      u_recolorSaturation: "recolorSaturation",
      u_recolorLightness: "recolorLightness",
      u_recolorAmount: "recolorAmount",
      u_recolorPreserveLum: "recolorPreserveLum",
    }

    for (const name of extras) {
      if (name === "u_recolorColor" && Array.isArray(values.u_recolorColor)) {
        this.lastUniformValues.set(name, values.u_recolorColor)
        continue
      }
      const key = toolToUniform[name]
      if (key && values[key] !== undefined) {
        this.lastUniformValues.set(name, values[key])
      }
    }
  }

  setUniforms(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    const allUniforms = this.getAllUniforms()

    Object.entries(allUniforms).forEach(([name, value]) => {
      // Check if the uniform value has changed
      const lastValue = this.lastUniformValues.get(name)
      if (lastValue === value) {
        return // Skip if value hasn't changed
      }

      // Get or cache uniform location
      let location = this.uniformLocations.get(name)
      if (location === undefined) {
        location = gl.getUniformLocation(program, name)
        this.uniformLocations.set(name, location)
      }

      if (location !== null) {
        if (typeof value === "number") {
          if (name.endsWith("Enabled")) {
            gl.uniform1i(location, Math.round(value))
          } else {
            gl.uniform1f(location, value)
          }
        } else if (typeof value === "boolean") {
          gl.uniform1i(location, value ? 1 : 0)
        } else if (Array.isArray(value)) {
          const arr = value as unknown as number[]
          if (arr.length === 2) {
            gl.uniform2f(location, arr[0] ?? 0, arr[1] ?? 0)
          } else if (arr.length === 3) {
            gl.uniform3f(location, arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0)
          }
        }

        // Cache the new value
        this.lastUniformValues.set(name, value)
      }
    })

    // Handle uniforms that may be computed by validation but not part of plugin uniform maps
    // Example: recolor color supplied as vec3 via `u_recolorColor`
    const extraUniforms: Array<[string, any]> = []
    // If any plugin provided u_recolor but not u_recolorColor location cached yet, still try to set it
    if ((allUniforms as any).u_recolorColor) {
      const val = (allUniforms as any).u_recolorColor as number[]
      if (Array.isArray(val) && val.length === 3) {
        const loc = gl.getUniformLocation(program, "u_recolorColor")
        if (loc) {
          gl.uniform3f(loc, val[0] ?? 0, val[1] ?? 0, val[2] ?? 0)
          this.lastUniformValues.set("u_recolorColor", val)
        }
      }
    }

    // Also set Affinity-style recolor uniforms if present in values
    const maybeSetNumber = (name: string) => {
      const val =
        (allUniforms as any)[name] ?? (this as any)[name] ?? ({} as any)
      // We don't have them in plugin uniform map; try pulling from lastUniformValues cache fallback is not helpful.
    }

    const setIfPresent = (
      name: string,
      setter: (loc: WebGLUniformLocation, v: any) => void
    ) => {
      const value = (allUniforms as any)[name] as any
      const loc = gl.getUniformLocation(program, name)
      if (loc && value !== undefined) {
        setter(loc, value)
        this.lastUniformValues.set(name, value)
      }
    }

    // Pull from validatedParameters directly via last call: in this manager, callers pass validatedParameters into updateUniforms of plugins; plugins don't store these extras.
    // So we try to read from global 'validatedParameters' path isn't available. Instead, allow setting via uniform locations found and values stored in lastUniformValues already.
    // Fallback: query locations and set from last known values if present in lastUniformValues.
    const names = [
      "u_recolorHue",
      "u_recolorSaturation",
      "u_recolorLightness",
      "u_recolorAmount",
      "u_recolorPreserveLum",
    ]
    for (const name of names) {
      const loc = gl.getUniformLocation(program, name)
      if (!loc) continue
      // Try lastUniformValues first; callers should have primed via previous set
      const cached = this.lastUniformValues.get(name)
      if (cached !== undefined) {
        if (name === "u_recolorPreserveLum") {
          gl.uniform1i(loc, cached ? 1 : 0)
        } else {
          gl.uniform1f(loc, Number(cached) || 0)
        }
        continue
      }
      // As a fallback, set neutral defaults
      if (name === "u_recolorPreserveLum") gl.uniform1i(loc, 1)
      else if (name === "u_recolorHue") gl.uniform1f(loc, 0.0)
      else if (name === "u_recolorSaturation") gl.uniform1f(loc, 50.0)
      else if (name === "u_recolorLightness") gl.uniform1f(loc, 50.0)
      else if (name === "u_recolorAmount") gl.uniform1f(loc, 0.0)
    }
  }

  cleanup(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program)
      this.program = null
    }
    this.uniformLocations.clear()
    this.lastUniformValues.clear()
  }

  clearUniformCache(): void {
    this.uniformLocations.clear()
    this.lastUniformValues.clear()
  }
}
