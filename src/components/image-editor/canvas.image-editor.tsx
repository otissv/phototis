"use client"

import React from "react"
import { cn } from "@/lib/utils"

import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"
import { upscaleTool } from "./tools/upscaler"

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
    
    // Apply brightness (normalized to 0-2 range)
    color.rgb *= (u_brightness / 100.0);
    
    // Apply contrast (normalized to 0-2 range)
    color.rgb = ((color.rgb - 0.5) * (u_contrast / 100.0)) + 0.5;
    
    // Convert to HSV for hue and saturation adjustments
    vec3 hsv = rgb2hsv(color.rgb);
    
    // Apply hue rotation (normalized to 0-1 range)
    hsv.x = mod(hsv.x + (u_hue / 360.0), 1.0);
    
    // Apply saturation (normalized to 0-2 range)
    hsv.y *= (u_saturation / 100.0);
    
    // Convert back to RGB
    color.rgb = hsv2rgb(hsv);
    
    // Apply exposure (normalized to -1 to 1 range)
    color.rgb *= pow(2.0, u_exposure / 100.0);
    
    // Apply temperature (normalized to -1 to 1 range)
    color.rgb += vec3(u_temperature / 100.0, 0.0, -u_temperature / 100.0);
    
    // Apply gamma (normalized to 0.1-3.0 range)
    color.rgb = pow(color.rgb, vec3(1.0 / u_gamma));
    
    // Apply vintage effect (vignette)
    float vignette = 1.0 - length(uv - 0.5) * (u_vintage / 100.0);
    color.rgb *= vignette;
    
    // Apply blur with different types
    if (u_blur > 0.0) {
      float blurAmount = u_blur / 100.0;
      vec2 blurSize = vec2(blurAmount * 0.2) / u_resolution;
      vec4 blurColor = vec4(0.0);
      float total = 0.0;
      
      if (u_blurType < 0.5) { // Gaussian Blur
        for (float x = -8.0; x <= 8.0; x++) {
          for (float y = -8.0; y <= 8.0; y++) {
            float weight = exp(-(x*x + y*y) / (8.0 * blurAmount * blurAmount));
            blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize) * weight;
            total += weight;
          }
        }
      } else if (u_blurType < 1.5) { // Box Blur
        for (float x = -6.0; x <= 6.0; x++) {
          for (float y = -6.0; y <= 6.0; y++) {
            blurColor += texture2D(u_image, uv + vec2(x, y) * blurSize);
            total += 1.0;
          }
        }
      } else if (u_blurType < 2.5) { // Motion Blur
        float angle = u_blurDirection * 3.14159 / 180.0;
        vec2 direction = vec2(cos(angle), sin(angle));
        for (float i = -12.0; i <= 12.0; i++) {
          blurColor += texture2D(u_image, uv + direction * i * blurSize * 3.0);
          total += 1.0;
        }
      } else { // Radial Blur
        vec2 center = vec2(0.5 + u_blurCenter * 0.5, 0.5);
        vec2 dir = uv - center;
        float dist = length(dir);
        for (float i = -12.0; i <= 12.0; i++) {
          vec2 offset = dir * i * blurSize * 3.0;
          blurColor += texture2D(u_image, uv + offset);
          total += 1.0;
        }
      }
      
      color = mix(color, blurColor / total, blurAmount * 2.0);
    }
    
    // Apply invert (normalized to 0-1 range)
    if (u_invert > 0.0) {
      color.rgb = mix(color.rgb, 1.0 - color.rgb, u_invert / 100.0);
    }
    
    // Apply sepia (normalized to 0-1 range)
    if (u_sepia > 0.0) {
      vec3 sepia = vec3(
        dot(color.rgb, vec3(0.393, 0.769, 0.189)),
        dot(color.rgb, vec3(0.349, 0.686, 0.168)),
        dot(color.rgb, vec3(0.272, 0.534, 0.131))
      );
      color.rgb = mix(color.rgb, sepia, u_sepia / 100.0);
    }
    
    // Apply grayscale (normalized to 0-1 range)
    if (u_grayscale > 0.0) {
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(color.rgb, vec3(gray), u_grayscale / 100.0);
    }
    
    // Apply tint (normalized to -1 to 1 range)
    if (u_tint > 0.0) {
      color.rgb += vec3(u_tint / 100.0, 0.0, 0.0);
    }
    
    // Apply vibrance (normalized to -1 to 1 range)
    if (u_vibrance > 0.0) {
      float maxChannel = max(max(color.r, color.g), color.b);
      float minChannel = min(min(color.r, color.g), color.b);
      float saturation = (maxChannel - minChannel) / maxChannel;
      color.rgb = mix(color.rgb, color.rgb * (1.0 + u_vibrance / 100.0), saturation);
    }
    
    // Apply noise (normalized to 0-0.5 range)
    if (u_noise > 0.0) {
      float noise = random(uv) * (u_noise / 100.0);
      color.rgb += noise;
    }
    
    // Apply grain (normalized to 0-0.5 range)
    if (u_grain > 0.0) {
      float grain = random(uv * 100.0) * (u_grain / 100.0);
      color.rgb += grain;
    }
    
    gl_FragColor = color;
  }
`

export interface ImageEditorCanvasProps extends React.ComponentProps<"canvas"> {
  image: File
  toolsValues: ImageEditorToolsState
  onProgress?: (progress: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement> | null
  onDrawReady?: (draw: () => void) => void
}

export function ImageEditorCanvas({
  image,
  toolsValues,
  onProgress,
  canvasRef = null,
  onDrawReady,
  ...props
}: ImageEditorCanvasProps) {
  const [imageUrl, setImageUrl] = React.useState<string>("")
  const glRef = React.useRef<WebGL2RenderingContext | null>(null)
  const programRef = React.useRef<WebGLProgram | null>(null)
  const textureRef = React.useRef<WebGLTexture | null>(null)
  const positionBufferRef = React.useRef<WebGLBuffer | null>(null)
  const texCoordBufferRef = React.useRef<WebGLBuffer | null>(null)
  const [processing, setProcessing] = React.useState(0)

  // Handle image URL creation and cleanup
  React.useEffect(() => {
    const url = URL.createObjectURL(image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  // Initialize WebGL context and shaders
  React.useEffect(() => {
    // 1. Initial Checks
    if (!canvasRef.current || !imageUrl) return

    const canvas = canvasRef.current
    const gl = canvas.getContext("webgl2")
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }
    glRef.current = gl

    // 2. Shader Creation and Compilation
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    if (!vertexShader) return
    gl.shaderSource(vertexShader, vertexShaderSource)
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fragmentShader) return
    gl.shaderSource(fragmentShader, fragmentShaderSource)
    gl.compileShader(fragmentShader)

    // 3. WebGL Program Creation
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    // Program linking check
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Failed to link program:", gl.getProgramInfoLog(program))
      return
    }
    programRef.current = program

    // 4. Buffer Creation and Setup
    // Position Buffer
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), // Full screen quad
      gl.STATIC_DRAW
    )
    positionBufferRef.current = positionBuffer

    // Texture Coordinate Buffer
    const texCoordBuffer = gl.createBuffer()
    if (!texCoordBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), // UV coordinates
      gl.STATIC_DRAW
    )
    texCoordBufferRef.current = texCoordBuffer

    // 5. Texture Creation and Setup
    const texture = gl.createTexture()
    if (!texture) return
    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    textureRef.current = texture

    // 6. Image Loading and Canvas Setup
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Calculate dimensions while maintaining aspect ratio
      const aspectRatio = img.width / img.height
      const maxWidth = 800
      const maxHeight = 600

      let width = img.width
      let height = img.height

      // Resize logic
      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }
      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      // Set canvas dimensions
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)

      // Flip texture vertically
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

      // Upload image to GPU
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

      // Initial render
      draw()
    }
    img.src = imageUrl

    // 7. Cleanup Function
    return () => {
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(texCoordBuffer)
      gl.deleteTexture(texture)
    }
  }, [imageUrl])

  // Upscaling
  React.useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !imageUrl || !toolsValues.upscale) {
      return
    }

    const upscale = async () => {
      try {
        const image = await upscaleTool({
          imageUrl,
          upscale: toolsValues.upscale,
          patchSize: 64,
          padding: 2,
          awaitNextFrame: true,
          onProgress: (progress) => {
            const roundedProgress = Math.round(progress * 100)

            if (roundedProgress === 100) {
              onProgress?.(0)
              setProcessing(0)
            } else {
              onProgress?.(roundedProgress)
              setProcessing(roundedProgress)
            }
          },
        })

        if (image && glRef.current && textureRef.current) {
          const gl = glRef.current

          // Create a new image from the base64 string
          const upscaledImage = new Image()
          upscaledImage.crossOrigin = "anonymous"
          upscaledImage.src = image

          upscaledImage.onload = () => {
            // Update canvas dimensions
            const aspectRatio = upscaledImage.width / upscaledImage.height
            const maxWidth = 800 * toolsValues.upscale
            const maxHeight = 600 * toolsValues.upscale

            let width = upscaledImage.width
            let height = upscaledImage.height

            // Resize logic
            if (width > maxWidth) {
              width = maxWidth
              height = width / aspectRatio
            }
            if (height > maxHeight) {
              height = maxHeight
              width = height * aspectRatio
            }

            // Set new canvas dimensions
            canvas.width = width
            canvas.height = height
            gl.viewport(0, 0, width, height)

            // Upload upscaled image to GPU
            gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              upscaledImage
            )

            // Reset processing state
            setProcessing(0)

            // Trigger redraw
            draw()
          }
        }
      } catch (error) {
        console.error("Error during upscaling:", error)
        setProcessing(0)
      }
    }

    upscale()
  }, [imageUrl, toolsValues.upscale])

  // Resizing
  React.useEffect(() => {
    const canvas = canvasRef.current

    if (
      !canvas ||
      !imageUrl ||
      !toolsValues.resize.width ||
      !toolsValues.resize.height
    ) {
      return
    }

    if (glRef.current && textureRef.current) {
      const gl = glRef.current

      // Create a new image from the base64 string
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = imageUrl

      img.onload = () => {
        // Update canvas dimensions
        const aspectRatio = img.width / img.height
        const maxWidth = 800 * toolsValues.resize.width
        const maxHeight = 600 * toolsValues.resize.height

        let width = toolsValues.resize.width
        let height = toolsValues.resize.height

        // Resize logic
        if (width > maxWidth) {
          width = maxWidth
          height = width / aspectRatio
        }
        if (height > maxHeight) {
          height = maxHeight
          width = height * aspectRatio
        }

        // Set new canvas dimensions
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)

        // Upload upscaled image to GPU
        gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

        // Reset processing state
        setProcessing(0)

        // Trigger redraw
        draw()
      }
    }
    return
  }, [imageUrl, toolsValues.resize.width, toolsValues.resize.height])

  // Draw function
  // const draw = React.useCallback(() => {
  //   const gl = glRef.current
  //   const program = programRef.current
  //   if (!gl || !program) return

  //   gl.useProgram(program)

  //   // Set uniforms with proper normalization
  //   const uniforms = {
  //     u_brightness: toolsValues.brightness || 100,
  //     u_contrast: toolsValues.contrast || 100,
  //     u_saturation: toolsValues.saturation || 100,
  //     u_hue: toolsValues.hue || 0,
  //     u_exposure: toolsValues.exposure || 0,
  //     u_temperature: toolsValues.temperature || 0,
  //     u_gamma: toolsValues.gamma || 1,
  //     u_vintage: toolsValues.vintage || 0,
  //     u_blur: toolsValues.blur || 0,
  //     u_blurType: toolsValues.blurType || 0,
  //     u_blurDirection: toolsValues.blurDirection || 0,
  //     u_blurCenter: toolsValues.blurCenter || 0.5,
  //     u_invert: toolsValues.invert || 0,
  //     u_sepia: toolsValues.sepia || 0,
  //     u_grayscale: toolsValues.grayscale || 0,
  //     u_tint: toolsValues.tint || 0,
  //     u_vibrance: toolsValues.vibrance || 0,
  //     u_noise: toolsValues.noise || 0,
  //     u_grain: toolsValues.grain || 0,
  //     u_resolution: [gl.canvas.width, gl.canvas.height],
  //     u_rotate: toolsValues.rotate || 0,
  //     u_scale: toolsValues.scale || 1,
  //     u_flipHorizontal: toolsValues.flipHorizontal || false,
  //     u_flipVertical: toolsValues.flipVertical || false,
  //   }

  //   Object.entries(uniforms).forEach(([name, value]) => {
  //     const location = gl.getUniformLocation(program, name)
  //     if (location === null) {
  //       console.warn(`Uniform location not found for ${name}`)
  //       return
  //     }

  //     if (Array.isArray(value)) {
  //       gl.uniform2f(location, value[0], value[1])
  //     } else if (typeof value === "boolean") {
  //       gl.uniform1i(location, value ? 1 : 0)
  //     } else {
  //       gl.uniform1f(location, value)
  //     }
  //   })

  //   // Set attributes
  //   const positionLocation = gl.getAttribLocation(program, "a_position")
  //   const texCoordLocation = gl.getAttribLocation(program, "a_texCoord")

  //   gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current)
  //   gl.enableVertexAttribArray(positionLocation)
  //   gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  //   gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current)
  //   gl.enableVertexAttribArray(texCoordLocation)
  //   gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

  //   // Draw
  //   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  // }, [
  //   toolsValues.brightness,
  //   toolsValues.contrast,
  //   toolsValues.saturation,
  //   toolsValues.hue,
  //   toolsValues.exposure,
  //   toolsValues.temperature,
  //   toolsValues.gamma,
  //   toolsValues.vintage,
  //   toolsValues.blur,
  //   toolsValues.blurType,
  //   toolsValues.blurDirection,
  //   toolsValues.blurCenter,
  //   toolsValues.invert,
  //   toolsValues.sepia,
  //   toolsValues.grayscale,
  //   toolsValues.tint,
  //   toolsValues.vibrance,
  //   toolsValues.noise,
  //   toolsValues.grain,
  //   toolsValues.rotate,
  //   toolsValues.scale,
  //   toolsValues.flipHorizontal,
  //   toolsValues.flipVertical,
  // ])

  const draw = React.useCallback(() => {
    const gl = glRef.current
    const program = programRef.current
    if (!gl || !program) return

    gl.useProgram(program)

    // Set position attribute
    const positionLocation = gl.getAttribLocation(program, "a_position")
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Set texCoord attribute
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord")
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current)
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

    // Set uniforms from toolsValues
    const setUniform1f = (name: string, value: number) => {
      const location = gl.getUniformLocation(program, name)
      if (location) gl.uniform1f(location, value)
    }

    const setUniformBool = (name: string, value: boolean) => {
      const location = gl.getUniformLocation(program, name)
      if (location) gl.uniform1i(location, value ? 1 : 0)
    }

    // Example of setting values
    setUniform1f("u_brightness", toolsValues.brightness ?? 100)
    setUniform1f("u_contrast", toolsValues.contrast ?? 100)
    setUniform1f("u_saturation", toolsValues.saturation ?? 100)
    setUniform1f("u_hue", toolsValues.hue ?? 0)
    setUniform1f("u_exposure", toolsValues.exposure ?? 0)
    setUniform1f("u_temperature", toolsValues.temperature ?? 0)
    setUniform1f("u_gamma", toolsValues.gamma ?? 1)
    setUniform1f("u_vintage", toolsValues.vintage ?? 0)
    setUniform1f("u_blur", toolsValues.blur ?? 0)
    setUniform1f("u_blurType", toolsValues.blurType ?? 0)
    setUniform1f("u_blurDirection", toolsValues.blurDirection ?? 0)
    setUniform1f("u_blurCenter", toolsValues.blurCenter ?? 0)
    setUniform1f("u_invert", toolsValues.invert ?? 0)
    setUniform1f("u_sepia", toolsValues.sepia ?? 0)
    setUniform1f("u_grayscale", toolsValues.grayscale ?? 0)
    setUniform1f("u_tint", toolsValues.tint ?? 0)
    setUniform1f("u_vibrance", toolsValues.vibrance ?? 0)
    setUniform1f("u_noise", toolsValues.noise ?? 0)
    setUniform1f("u_grain", toolsValues.grain ?? 0)
    setUniform1f("u_rotate", toolsValues.rotate ?? 0)
    setUniform1f("u_scale", toolsValues.scale ?? 1)
    setUniformBool("u_flipHorizontal", toolsValues.flipHorizontal ?? false)
    setUniformBool("u_flipVertical", toolsValues.flipVertical ?? false)

    // Set resolution
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution")
    if (resolutionLocation)
      gl.uniform2f(
        resolutionLocation,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight
      )

    // Bind texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
    const samplerLocation = gl.getUniformLocation(program, "u_image")
    if (samplerLocation) gl.uniform1i(samplerLocation, 0)

    // Draw
    gl.clear(gl.COLOR_BUFFER_BIT)
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
  draw()

  React.useEffect(() => {
    onDrawReady?.(draw)
  }, [draw, onDrawReady])

  return (
    <div className='relative'>
      <canvas
        ref={canvasRef}
        className={cn(
          "max-w-full max-h-full object-contain"
          // processing && "opacity-30"
        )}
        style={{
          transform: `scale(${toolsValues.zoom / 100})`,
          transformOrigin: "center",
        }}
        {...props}
        id='image-editor-canvas'
      />
      {processing > 0 && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='text-sm '>Upscaling {processing}%</div>
        </div>
      )}
    </div>
  )
}
