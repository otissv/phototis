"use client"

import React from "react"
import type { ImageEditorToolsState } from "./image-editor.state"
import { transform } from "motion/react"

// Vertex shader for rendering a full-screen quad
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform float u_rotate;
  uniform float u_scale;
  uniform bool u_flipHorizontal;
  uniform bool u_flipVertical;
  
  void main() {
    // Apply rotation
    float angle = u_rotate * 3.14159 / 180.0;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec2 rotatedPos = vec2(
      a_position.x * cosA - a_position.y * sinA,
      a_position.x * sinA + a_position.y * cosA
    );
    
    // Apply scale
    rotatedPos *= u_scale;
    
    // Apply flips
    if (u_flipHorizontal) {
      rotatedPos.x = -rotatedPos.x;
    }
    if (u_flipVertical) {
      rotatedPos.y = -rotatedPos.y;
    }
    
    gl_Position = vec4(rotatedPos, 0, 1);
    v_texCoord = a_texCoord;
  }
`

// Fragment shader for image processing
const fragmentShaderSource = `
  precision highp float;
  uniform sampler2D u_image;
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_hue;
  uniform float u_exposure;
  uniform float u_temperature;
  uniform float u_gamma;
  uniform float u_vintage;
  uniform float u_blur;
  uniform float u_blurType;
  uniform float u_blurDirection;
  uniform float u_blurCenter;
  uniform float u_invert;
  uniform float u_sepia;
  uniform float u_grayscale;
  uniform float u_tint;
  uniform float u_vibrance;
  uniform float u_noise;
  uniform float u_grain;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;

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

  // Noise function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = v_texCoord;
    vec4 color = texture2D(u_image, uv);
    
    // Apply brightness
    color.rgb *= u_brightness / 100.0;
    
    // Apply contrast
    color.rgb = (color.rgb - 0.5) * (u_contrast / 100.0) + 0.5;
    
    // Convert to HSV for hue and saturation adjustments
    vec3 hsv = rgb2hsv(color.rgb);
    
    // Apply hue rotation
    hsv.x = mod(hsv.x + u_hue / 360.0, 1.0);
    
    // Apply saturation
    hsv.y *= u_saturation / 100.0;
    
    // Convert back to RGB
    color.rgb = hsv2rgb(hsv);
    
    // Apply exposure
    color.rgb *= pow(2.0, u_exposure / 100.0);
    
    // Apply temperature
    color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
    
    // Apply gamma
    color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
    
    // Apply vintage effect (vignette)
    float vignette = 1.0 - length(uv - 0.5) * u_vintage / 100.0;
    color.rgb *= vignette;
    
    // Apply blur with different types
    if (u_blur > 0.0) {
      float blurAmount = u_blur / 100.0;
      vec2 blurSize = vec2(blurAmount * 0.2) / u_resolution;
      vec4 blurColor = vec4(0.0);
      float total = 0.0;
      
      if (u_blurType < 0.5) { // Gaussian Blur
        for (float x = -16.0; x <= 16.0; x++) {
          for (float y = -16.0; y <= 16.0; y++) {
            float weight = exp(-(x*x + y*y) / (16.0 * blurAmount * blurAmount));
            blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize) * weight;
            total += weight;
          }
        }
      } else if (u_blurType < 1.5) { // Box Blur
        for (float x = -12.0; x <= 12.0; x++) {
          for (float y = -12.0; y <= 12.0; y++) {
            blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize);
            total += 1.0;
          }
        }
      } else if (u_blurType < 2.5) { // Motion Blur
        float angle = u_blurDirection * 3.14159 / 180.0;
        vec2 direction = vec2(cos(angle), sin(angle));
        for (float i = -24.0; i <= 24.0; i++) {
          blurColor += texture2D(u_image, uv + direction * i * blurSize * 6.0);
          total += 1.0;
        }
      } else { // Radial Blur
        vec2 center = vec2(0.5 + u_blurCenter * 0.5, 0.5);
        vec2 dir = uv - center;
        float dist = length(dir);
        for (float i = -24.0; i <= 24.0; i++) {
          vec2 offset = dir * i * blurSize * 6.0;
          blurColor += texture2D(u_image, uv + offset);
          total += 1.0;
        }
      }
      
      color = mix(color, blurColor / total, blurAmount * 4.0);
    }
    
    // Apply invert
    if (u_invert > 0.0) {
      color.rgb = mix(color.rgb, 1.0 - color.rgb, u_invert / 100.0);
    }
    
    // Apply sepia
    if (u_sepia > 0.0) {
      vec3 sepia = vec3(
        dot(color.rgb, vec3(0.393, 0.769, 0.189)),
        dot(color.rgb, vec3(0.349, 0.686, 0.168)),
        dot(color.rgb, vec3(0.272, 0.534, 0.131))
      );
      color.rgb = mix(color.rgb, sepia, u_sepia / 100.0);
    }
    
    // Apply grayscale
    if (u_grayscale > 0.0) {
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(color.rgb, vec3(gray), u_grayscale / 100.0);
    }
    
    // Apply tint
    if (u_tint > 0.0) {
      color.rgb += vec3(u_tint / 100.0, 0.0, 0.0);
    }
    
    // Apply vibrance
    if (u_vibrance > 0.0) {
      float maxChannel = max(max(color.r, color.g), color.b);
      float minChannel = min(min(color.r, color.g), color.b);
      float saturation = (maxChannel - minChannel) / maxChannel;
      color.rgb = mix(color.rgb, color.rgb * (1.0 + u_vibrance / 100.0), saturation);
    }
    
    // Apply noise
    if (u_noise > 0.0) {
      float noise = random(uv) * u_noise / 100.0;
      color.rgb += noise;
    }
    
    // Apply grain
    if (u_grain > 0.0) {
      float grain = random(uv * 100.0) * u_grain / 100.0;
      color.rgb += grain;
    }
    
    gl_FragColor = color;
  }
`

export interface ImageEditorCanvasProps extends React.ComponentProps<"canvas"> {
  image: File
  toolsValues: ImageEditorToolsState
}

export function ImageEditorCanvas({
  image,
  toolsValues,
  ...props
}: ImageEditorCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [imageUrl, setImageUrl] = React.useState<string>("")
  const glRef = React.useRef<WebGL2RenderingContext | null>(null)
  const programRef = React.useRef<WebGLProgram | null>(null)
  const textureRef = React.useRef<WebGLTexture | null>(null)
  const positionBufferRef = React.useRef<WebGLBuffer | null>(null)
  const texCoordBufferRef = React.useRef<WebGLBuffer | null>(null)

  // Handle image URL creation and cleanup
  React.useEffect(() => {
    const url = URL.createObjectURL(image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  // Initialize WebGL context and shaders
  React.useEffect(() => {
    if (!canvasRef.current || !imageUrl) return

    const canvas = canvasRef.current
    const gl = canvas.getContext("webgl2")
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }

    glRef.current = gl

    // Create and compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    if (!vertexShader) return
    gl.shaderSource(vertexShader, vertexShaderSource)
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fragmentShader) return
    gl.shaderSource(fragmentShader, fragmentShaderSource)
    gl.compileShader(fragmentShader)

    // Create program
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Failed to link program:", gl.getProgramInfoLog(program))
      return
    }

    programRef.current = program

    // Create buffers
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    // Keep the original position coordinates
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    positionBufferRef.current = positionBuffer

    const texCoordBuffer = gl.createBuffer()
    if (!texCoordBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    // Keep the original texture coordinates
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    texCoordBufferRef.current = texCoordBuffer

    // Create texture
    const texture = gl.createTexture()
    if (!texture) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    textureRef.current = texture

    // Load image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Set canvas dimensions
      const aspectRatio = img.width / img.height
      const maxWidth = 800
      const maxHeight = 600

      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }

      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)

      // Add this line to flip the texture right-side up
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

      // Upload image to texture
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

      // Draw
      draw()
    }
    img.src = imageUrl

    return () => {
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(texCoordBuffer)
      gl.deleteTexture(texture)
    }
  }, [imageUrl])

  // Draw function
  const draw = React.useCallback(() => {
    const gl = glRef.current
    const program = programRef.current
    if (!gl || !program) return

    gl.useProgram(program)

    // Set uniforms
    const uniforms = {
      u_brightness: toolsValues.brightness,
      u_contrast: toolsValues.contrast,
      u_saturation: toolsValues.saturation,
      u_hue: toolsValues.hue,
      u_exposure: toolsValues.exposure,
      u_temperature: toolsValues.temperature,
      u_gamma: toolsValues.gamma,
      u_vintage: toolsValues.vintage,
      u_blur: toolsValues.blur,
      u_blurType: toolsValues.blurType,
      u_blurDirection: toolsValues.blurDirection,
      u_blurCenter: toolsValues.blurCenter,
      u_invert: toolsValues.invert,
      u_sepia: toolsValues.sepia,
      u_grayscale: toolsValues.grayscale,
      u_tint: toolsValues.tint,
      u_vibrance: toolsValues.vibrance,
      u_noise: toolsValues.noise,
      u_grain: toolsValues.grain,
      u_resolution: [gl.canvas.width, gl.canvas.height],
      u_rotate: toolsValues.rotate,
      u_scale: toolsValues.scale,
      u_flipHorizontal: toolsValues.flipHorizontal,
      u_flipVertical: toolsValues.flipVertical,
    }

    Object.entries(uniforms).forEach(([name, value]) => {
      const location = gl.getUniformLocation(program, name)
      if (location === null) {
        console.warn(`Uniform location not found for ${name}`)
        return
      }

      if (Array.isArray(value)) {
        gl.uniform2f(location, value[0], value[1])
      } else if (typeof value === "boolean") {
        gl.uniform1i(location, value ? 1 : 0)
      } else {
        gl.uniform1f(location, value)
      }
    })

    // Set attributes
    const positionLocation = gl.getAttribLocation(program, "a_position")
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord")

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current)
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }, [
    toolsValues.brightness,
    toolsValues.contrast,
    toolsValues.saturation,
    toolsValues.hue,
    toolsValues.exposure,
    toolsValues.temperature,
    toolsValues.gamma,
    toolsValues.vintage,
    toolsValues.blur,
    toolsValues.blurType,
    toolsValues.blurDirection,
    toolsValues.blurCenter,
    toolsValues.invert,
    toolsValues.sepia,
    toolsValues.grayscale,
    toolsValues.tint,
    toolsValues.vibrance,
    toolsValues.noise,
    toolsValues.grain,
    toolsValues.rotate,
    toolsValues.scale,
    toolsValues.flipHorizontal,
    toolsValues.flipVertical,
  ])

  // Redraw when tools values change
  React.useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className='max-w-full max-h-full object-contain'
      style={{
        transform: `scale(${toolsValues.zoom / 100})`,
        transformOrigin: "center",
      }}
      {...props}
      id='image-editor-canvas'
    />
  )
}
