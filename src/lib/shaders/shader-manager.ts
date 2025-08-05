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

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
    `

    // Add main function that combines all effects
    combined += `
      
      void main() {
        vec2 uv = v_texCoord;
        vec4 color = texture2D(u_image, uv);
        
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
        
        if (u_tint > 0.0) {
          color.rgb += vec3(u_tint / 100.0, 0.0, 0.0);
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
          gl.uniform1f(location, value)
        } else if (typeof value === "boolean") {
          gl.uniform1i(location, value ? 1 : 0)
        } else if (Array.isArray(value) && value.length === 2) {
          gl.uniform2f(location, value[0], value[1])
        }

        // Cache the new value
        this.lastUniformValues.set(name, value)
      }
    })
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
