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

    // Combine all vertex shaders (use the first one as base)
    const baseVertexShader = this.plugins[0].vertexShader

    // Combine all fragment shaders
    const fragmentShaders = this.plugins.map((plugin) => plugin.fragmentShader)
    const combinedFragmentShader = this.combineFragmentShaders(fragmentShaders)

    // Create and compile vertex shader
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)
    if (!vertexShader) return false
    this.gl.shaderSource(vertexShader, baseVertexShader)
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

  private combineFragmentShaders(shaders: string[]): string {
    // Start with precision and common uniforms
    let combined = `
      precision highp float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_opacity;
      // Solid fill uniforms
      uniform int u_solidEnabled;
      uniform vec3 u_solidColor;
      uniform float u_solidAlpha;
      // Recolor color (when recolor provided as color+amount)
      uniform vec3 u_recolorColor;
      // Affinity-style recolor uniforms
      uniform float u_recolorHue;
      uniform float u_recolorSaturation;
      uniform float u_recolorLightness;
      uniform int u_recolorPreserveLum;
      uniform float u_recolorAmount;
      varying vec2 v_texCoord;
    `

    // Add all uniform declarations from all shaders
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

    // Add unique uniforms
    uniformSet.forEach((uniform) => {
      combined += `\n  ${uniform}`
    })

    // Add helper functions
    combined += `
      
      // Helper functions
      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      // HSL helpers for recolor
      vec3 rgb2hsl(vec3 c) {
        float r = c.r, g = c.g, b = c.b;
        float maxc = max(max(r, g), b);
        float minc = min(min(r, g), b);
        float l = (maxc + minc) * 0.5;
        float h = 0.0;
        float s = 0.0;
        if (maxc != minc) {
          float d = maxc - minc;
          s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
          if (maxc == r) {
            h = (g - b) / d + (g < b ? 6.0 : 0.0);
          } else if (maxc == g) {
            h = (b - r) / d + 2.0;
          } else {
            h = (r - g) / d + 4.0;
          }
          h /= 6.0;
        }
        return vec3(h, s, l);
      }

      float hue2rgb(float p, float q, float t) {
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0/2.0) return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
      }

      vec3 hsl2rgb(vec3 hsl) {
        float h = hsl.x;
        float s = hsl.y;
        float l = hsl.z;
        float r, g, b;
        if (s == 0.0) {
          r = g = b = l;
        } else {
          float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
          float p = 2.0 * l - q;
          r = hue2rgb(p, q, h + 1.0/3.0);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1.0/3.0);
        }
        return vec3(r, g, b);
      }

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
    `

    // Add main function that combines all effects
    combined += `
      
      void main() {
        vec2 uv = v_texCoord;
        vec4 color = texture2D(u_image, uv);
        // Optional solid fill adjustment, rendered as top content with opacity
        if (u_solidEnabled == 1) {
          // Render solid directly; compositing step applies layer opacity/blend
          vec4 solidColor = vec4(u_solidColor, u_solidAlpha);
          color = solidColor;
        }
        
        // Apply color adjustments
        color.rgb *= (u_brightness / 100.0);
        color.rgb = ((color.rgb - 0.5) * (u_contrast / 100.0)) + 0.5;
        
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
        hsv.y *= (u_saturation / 100.0);
        color.rgb = hsv2rgb(hsv);
        
        color.rgb *= pow(2.0, u_exposure / 100.0);
        color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
        color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
        
        // Apply vintage effect
        float vignette = 1.0 - length(uv - 0.5) * (u_vintage / 100.0);
        color.rgb *= vignette;
        
        // Apply blur effects
        if (u_blur > 0.0) {
          float blurAmount = u_blur / 100.0;
          vec2 blurSize = vec2(blurAmount * 0.2) / u_resolution;
          vec4 blurColor = vec4(0.0);
          float total = 0.0;
          
          if (u_blurType < 0.5) {
            for (float x = -8.0; x <= 8.0; x++) {
              for (float y = -8.0; y <= 8.0; y++) {
                float weight = exp(-(x*x + y*y) / (8.0 * blurAmount * blurAmount));
                blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize) * weight;
                total += weight;
              }
            }
          } else if (u_blurType < 1.5) {
            for (float x = -6.0; x <= 6.0; x++) {
              for (float y = -6.0; y <= 6.0; y++) {
                blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize);
                total += 1.0;
              }
            }
          } else if (u_blurType < 2.5) {
            float angle = u_blurDirection * 3.14159 / 180.0;
            vec2 direction = vec2(cos(angle), sin(angle));
            for (float i = -12.0; i <= 12.0; i++) {
              blurColor += texture2D(u_image, uv + direction * i * blurSize * 3.0);
              total += 1.0;
            }
          } else {
            vec2 center = vec2(0.5 + u_blurCenter * 0.5, 0.5);
            vec2 dir = uv - center;
            for (float i = -12.0; i <= 12.0; i++) {
              vec2 offset = dir * i * blurSize * 3.0;
              blurColor += texture2D(u_image, uv + offset);
              total += 1.0;
            }
          }
          
          color = mix(color, blurColor / total, blurAmount * 2.0);
        }
        
        // Apply artistic effects
        if (u_invert > 0.0) {
          color.rgb = mix(color.rgb, 1.0 - color.rgb, u_invert / 100.0);
        }
        
        if (u_sepia > 0.0) {
          vec3 sepia = vec3(
            dot(color.rgb, vec3(0.393, 0.769, 0.189)),
            dot(color.rgb, vec3(0.349, 0.686, 0.168)),
            dot(color.rgb, vec3(0.272, 0.534, 0.131))
          );
          color.rgb = mix(color.rgb, sepia, u_sepia / 100.0);
        }
        
        if (u_grayscale > 0.0) {
          float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          color.rgb = mix(color.rgb, vec3(gray), u_grayscale / 100.0);
        }
        
        // Legacy recolor (color + amount)
        if (u_recolor != 0.0) {
          float amt = clamp(abs(u_recolor) / 100.0, 0.0, 1.0);
          color.rgb = mix(color.rgb, u_recolorColor, amt);
        }

        // Affinity-style Recolor: H/S/(L or preserve) with Amount
        if (u_recolorAmount > 0.0) {
          vec3 src = color.rgb;
          vec3 hsl = rgb2hsl(src);
          float h = mod((u_recolorHue / 360.0) + 1.0, 1.0);
          float s = clamp(u_recolorSaturation / 100.0, 0.0, 1.0);
          float l = (u_recolorPreserveLum == 1)
            ? hsl.z
            : clamp(u_recolorLightness / 100.0, 0.0, 1.0);
          vec3 recolored = hsl2rgb(vec3(h, s, l));
          float amt2 = clamp(u_recolorAmount / 100.0, 0.0, 1.0);
          color.rgb = mix(src, recolored, amt2);
        }
        
        if (u_vibrance > 0.0) {
          float maxChannel = max(max(color.r, color.g), color.b);
          float minChannel = min(min(color.r, color.g), color.b);
          float saturation = (maxChannel - minChannel) / maxChannel;
          color.rgb = mix(color.rgb, color.rgb * (1.0 + u_vibrance / 100.0), saturation);
        }
        
        if (u_noise > 0.0) {
          float noise = random(uv) * (u_noise / 100.0);
          color.rgb += noise;
        }
        
        if (u_grain > 0.0) {
          float grain = random(uv * 100.0) * (u_grain / 100.0);
          color.rgb += grain;
        }
        
        // Apply opacity
        color.a *= u_opacity / 100.0;
        
        if (color.a < 0.01) {
          discard;
        }
        
        gl_FragColor = color;
      }
    `

    return combined
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
