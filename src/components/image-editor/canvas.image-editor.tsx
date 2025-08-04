"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { motion, useMotionValue, useTransform, animate } from "motion/react"

import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"
import { initialState } from "@/components/image-editor/state.image-editor"
import { upscaleTool } from "./tools/upscaler"
import type { Layer } from "./layer-system"

// Vertex shader for rendering a full-screen quad
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform float u_rotate;
  uniform float u_scale;
  uniform bool u_flipHorizontal;
  uniform bool u_flipVertical;
  uniform vec2 u_layerSize;
  uniform vec2 u_canvasSize;
  uniform vec2 u_layerPosition;
  
  void main() {
    // Calculate normalized position within the layer
    vec2 layerPos = a_position * u_layerSize;
    
    // Apply rotation around layer center
    float angle = u_rotate * 3.14159 / 180.0;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec2 rotatedPos = vec2(
      layerPos.x * cosA - layerPos.y * sinA,
      layerPos.x * sinA + layerPos.y * cosA
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
    
    // Add layer position offset
    rotatedPos += u_layerPosition;
    
    // Convert to normalized device coordinates
    vec2 ndcPos = rotatedPos / u_canvasSize;
    
    gl_Position = vec4(ndcPos, 0, 1);
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
  uniform float u_opacity;
  uniform vec2 u_layerSize;
  uniform vec2 u_canvasSize;
  uniform vec2 u_layerPosition;
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
    
    // Apply opacity - this is crucial for layer transparency
    color.a *= u_opacity / 100.0;
    
    // Ensure proper alpha blending - if alpha is very low, make it transparent
    if (color.a < 0.01) {
      discard; // Don't render this pixel at all
    }
    
    gl_FragColor = color;
  }
`

export interface ImageEditorCanvasProps
  extends Omit<React.ComponentProps<"canvas">, "onProgress"> {
  image: File | null
  toolsValues: ImageEditorToolsState
  layers?: Layer[]
  onProgress?: (progress: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  onDrawReady?: (draw: () => void) => void
  onImageDrop?: (file: File) => void
  onCanvasDimensionsChange?: (dimensions: {
    width: number
    height: number
  }) => void
}

// Interface for layer dimensions and positioning
interface LayerDimensions {
  width: number
  height: number
  x: number
  y: number
}

// Interface for viewport state
interface ViewportState {
  x: number
  y: number
  scale: number
}

export function ImageEditorCanvas({
  image,
  toolsValues,
  layers = [],
  onProgress,
  canvasRef,
  onDrawReady,
  onImageDrop,
  onCanvasDimensionsChange,
  ...props
}: ImageEditorCanvasProps) {
  const [imageUrl, setImageUrl] = React.useState<string>("")
  const glRef = React.useRef<WebGL2RenderingContext | null>(null)
  const programRef = React.useRef<WebGLProgram | null>(null)
  const textureRef = React.useRef<WebGLTexture | null>(null)
  const positionBufferRef = React.useRef<WebGLBuffer | null>(null)
  const texCoordBufferRef = React.useRef<WebGLBuffer | null>(null)
  const [processing, setProcessing] = React.useState(0)

  // Texture cache for layer-specific images
  const textureCacheRef = React.useRef<Map<string, WebGLTexture>>(new Map())
  const imageUrlCacheRef = React.useRef<Map<string, string>>(new Map())

  // Layer dimensions cache
  const layerDimensionsRef = React.useRef<Map<string, LayerDimensions>>(
    new Map()
  )

  // Canvas dimensions state
  const [canvasDimensions, setCanvasDimensions] = React.useState({
    width: 800,
    height: 600,
  })

  // Motion values for smooth viewport handling
  const viewportX = useMotionValue(0)
  const viewportY = useMotionValue(0)
  const viewportScale = useMotionValue(1)

  // Current viewport state for calculations
  const [viewport, setViewport] = React.useState<ViewportState>({
    x: 0,
    y: 0,
    scale: 1,
  })

  // Transform values for smooth viewport updates
  const transformX = useTransform(viewportX, (x) => `${x}px`)
  const transformY = useTransform(viewportY, (y) => `${y}px`)
  const transformScale = useTransform(viewportScale, (scale) => scale)

  // Container ref for viewport calculations
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Function to calculate optimal canvas size based on all layers
  const calculateOptimalCanvasSize = React.useCallback(() => {
    const layerDimensions = Array.from(layerDimensionsRef.current.values())

    if (layerDimensions.length === 0) {
      return { width: 800, height: 600 }
    }

    // Find the maximum dimensions needed to contain all layers
    let maxWidth = 0
    let maxHeight = 0

    for (const layer of layerDimensions) {
      const layerRight = layer.x + layer.width
      const layerBottom = layer.y + layer.height

      maxWidth = Math.max(maxWidth, layerRight)
      maxHeight = Math.max(maxHeight, layerBottom)
    }

    // Ensure minimum dimensions and add some padding
    maxWidth = Math.max(maxWidth, 800)
    maxHeight = Math.max(maxHeight, 600)

    // Add padding to ensure layers don't touch the edges
    maxWidth += 100
    maxHeight += 100

    return { width: maxWidth, height: maxHeight }
  }, [])

  // Update WebGL viewport when canvas dimensions change
  React.useEffect(() => {
    const gl = glRef.current
    const canvas = canvasRef?.current

    if (gl && canvas) {
      // Update canvas size
      canvas.width = canvasDimensions.width
      canvas.height = canvasDimensions.height

      // Update WebGL viewport
      gl.viewport(0, 0, canvasDimensions.width, canvasDimensions.height)
    }
  }, [canvasDimensions, canvasRef?.current])

  // Handle image URL creation and cleanup for the main image
  React.useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  // Handle layer-specific image URLs and dimensions
  React.useEffect(() => {
    // Clean up old URLs
    const currentLayerIds = new Set(layers.map((layer) => layer.id))
    const oldUrls = new Map(imageUrlCacheRef.current)

    for (const [layerId, url] of oldUrls) {
      if (!currentLayerIds.has(layerId)) {
        URL.revokeObjectURL(url)
        imageUrlCacheRef.current.delete(layerId)
        textureCacheRef.current.delete(layerId)
        // Don't delete layer-1 dimensions as it's the background
        if (layerId !== "layer-1") {
          layerDimensionsRef.current.delete(layerId)
        }
      }
    }

    // Create URLs for new layer images and calculate dimensions
    for (const layer of layers) {
      if (layer.image && !imageUrlCacheRef.current.has(layer.id)) {
        const url = URL.createObjectURL(layer.image)
        imageUrlCacheRef.current.set(layer.id, url)

        // Calculate layer dimensions immediately
        const img = new Image()
        img.onload = () => {
          // Get current canvas dimensions
          const currentCanvasWidth = canvasDimensions.width
          const currentCanvasHeight = canvasDimensions.height

          // For new layers, center them on the current canvas
          // For background layer, position at origin
          let centerX = 0
          let centerY = 0

          if (layer.id !== "layer-1") {
            // Center new layers on the current canvas
            centerX = Math.max(0, (currentCanvasWidth - img.width) / 2)
            centerY = Math.max(0, (currentCanvasHeight - img.height) / 2)
          }

          const dimensions: LayerDimensions = {
            width: img.width,
            height: img.height,
            x: centerX,
            y: centerY,
          }
          layerDimensionsRef.current.set(layer.id, dimensions)

          // Update canvas dimensions to accommodate all layers
          const newDimensions = calculateOptimalCanvasSize()
        }
        img.src = url
      }
    }
  }, [layers, canvasDimensions, calculateOptimalCanvasSize])

  // Handle viewport updates based on zoom
  React.useEffect(() => {
    const zoom = toolsValues.zoom / 100
    viewportScale.set(zoom)
    setViewport((prev) => ({ ...prev, scale: zoom }))
  }, [toolsValues.zoom, viewportScale])

  // Function to center viewport on canvas
  const centerViewport = React.useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const currentScale = viewportScale.get()

    const centerX =
      (containerRect.width - canvasDimensions.width * currentScale) / 2
    const centerY =
      (containerRect.height - canvasDimensions.height * currentScale) / 2

    viewportX.set(centerX)
    viewportY.set(centerY)

    setViewport((prev) => ({
      ...prev,
      x: centerX,
      y: centerY,
    }))
  }, [canvasDimensions, viewportScale, viewportX, viewportY])

  // Function to reset viewport with smooth animation
  const resetViewport = React.useCallback(() => {
    viewportX.set(0)
    viewportY.set(0)
    viewportScale.set(1)

    setViewport({
      x: 0,
      y: 0,
      scale: 1,
    })
  }, [viewportX, viewportY, viewportScale])

  // Center viewport when canvas dimensions change
  React.useEffect(() => {
    centerViewport()
  }, [centerViewport])

  // Mouse/touch handlers for viewport navigation
  // const [isDragging, setIsDragging] = React.useState(false)
  // const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })

  // const handleMouseDown = React.useCallback(
  //   (e: React.MouseEvent) => {
  //     if (e.button === 0) {
  //       // Left mouse button
  //       setIsDragging(true)
  //       setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y })
  //     }
  //   },
  //   [viewport.x, viewport.y]
  // )

  // const handleMouseMove = React.useCallback(
  //   (e: React.MouseEvent) => {
  //     if (isDragging) {
  //       setViewport((prev) => ({
  //         ...prev,
  //         x: e.clientX - dragStart.x,
  //         y: e.clientY - dragStart.y,
  //       }))
  //     }
  //   },
  //   [isDragging, dragStart]
  // )

  // const handleMouseUp = React.useCallback(() => {
  //   setIsDragging(false)
  // }, [])

  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const currentScale = viewportScale.get()
      const newScale = Math.max(0.1, Math.min(5, currentScale * delta))

      // Zoom towards mouse position
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const currentX = viewportX.get()
      const currentY = viewportY.get()
      const scaleRatio = newScale / currentScale
      const newX = mouseX - (mouseX - currentX) * scaleRatio
      const newY = mouseY - (mouseY - currentY) * scaleRatio

      // Smoothly animate to new values
      viewportX.set(newX)
      viewportY.set(newY)
      viewportScale.set(newScale)

      setViewport({
        x: newX,
        y: newY,
        scale: newScale,
      })
    },
    [viewportX, viewportY, viewportScale]
  )

  // Double-click to reset viewport
  const handleDoubleClick = React.useCallback(() => {
    resetViewport()
  }, [resetViewport])

  // Initialize WebGL context and shaders
  React.useEffect(() => {
    // 1. Initial Checks
    if (!canvasRef?.current || !imageUrl) return

    const canvas = canvasRef.current
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: true,
    })
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
      // Set canvas dimensions based on the image
      canvas.width = img.width
      canvas.height = img.height
      gl.viewport(0, 0, img.width, img.height)

      // Flip texture vertically
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

      // Upload image to GPU
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

      // Store dimensions for the background layer
      layerDimensionsRef.current.set("layer-1", {
        width: img.width,
        height: img.height,
        x: 0,
        y: 0,
      })

      // Update canvas dimensions
      setCanvasDimensions({
        width: img.width,
        height: img.height,
      })

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
  }, [imageUrl, canvasRef?.current])

  // Upscaling
  React.useEffect(() => {
    const canvas = canvasRef?.current

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
            canvas.width = upscaledImage.width
            canvas.height = upscaledImage.height
            gl.viewport(0, 0, upscaledImage.width, upscaledImage.height)

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

            // Update background layer dimensions
            layerDimensionsRef.current.set("layer-1", {
              width: upscaledImage.width,
              height: upscaledImage.height,
              x: 0,
              y: 0,
            })

            // Update canvas dimensions
            setCanvasDimensions({
              width: upscaledImage.width,
              height: upscaledImage.height,
            })

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
  }, [imageUrl, canvasRef?.current, toolsValues.upscale, onProgress])

  // Resizing
  React.useEffect(() => {
    const canvas = canvasRef?.current

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
        canvas.width = toolsValues.resize.width
        canvas.height = toolsValues.resize.height
        gl.viewport(0, 0, toolsValues.resize.width, toolsValues.resize.height)

        // Upload resized image to GPU
        gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)

        // Update background layer dimensions
        layerDimensionsRef.current.set("layer-1", {
          width: toolsValues.resize.width,
          height: toolsValues.resize.height,
          x: 0,
          y: 0,
        })

        // Update canvas dimensions
        setCanvasDimensions({
          width: toolsValues.resize.width,
          height: toolsValues.resize.height,
        })

        // Reset processing state
        setProcessing(0)

        // Trigger redraw
        draw()
      }
    }
    return
  }, [
    imageUrl,
    canvasRef?.current,
    toolsValues.resize.width,
    toolsValues.resize.height,
  ])

  // Helper function to load texture for a layer
  const loadLayerTexture = React.useCallback(
    async (layer: Layer): Promise<WebGLTexture | null> => {
      const gl = glRef.current
      if (!gl) return null

      // Check if we already have a cached texture for this layer
      if (textureCacheRef.current.has(layer.id)) {
        return textureCacheRef.current.get(layer.id) || null
      }

      // If layer has its own image, use that
      if (layer.image && imageUrlCacheRef.current.has(layer.id)) {
        const imageUrl = imageUrlCacheRef.current.get(layer.id)
        if (!imageUrl) return null

        return new Promise((resolve) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            const texture = gl.createTexture()
            if (!texture) {
              resolve(null)
              return
            }

            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              img
            )

            textureCacheRef.current.set(layer.id, texture)
            resolve(texture)
          }
          img.src = imageUrl
        })
      }

      // Otherwise use the main texture
      return textureRef.current
    },
    []
  )

  // Draw function for multi-layer rendering with independent dimensions
  const draw = React.useCallback(async () => {
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

    // Enable blending for multi-layer composition
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.blendEquation(gl.FUNC_ADD)

    // Clear the canvas with transparent background
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Get canvas dimensions
    const canvas = canvasRef?.current
    if (!canvas) return

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    // Render each visible layer from bottom to top
    const visibleLayers = layers.filter(
      (layer) => layer.visible && (!layer.isEmpty || layer.image)
    )

    // Always ensure the background layer (layer-1) is rendered if it has dimensions
    const backgroundLayerDimensions = layerDimensionsRef.current.get("layer-1")
    const hasBackgroundLayer = backgroundLayerDimensions && imageUrl

    // Create a complete list of layers to render
    const allLayersToRender = [...visibleLayers]

    // Add background layer if it exists and isn't already in the list
    if (
      hasBackgroundLayer &&
      !allLayersToRender.find((layer) => layer.id === "layer-1")
    ) {
      // Create a background layer object for rendering
      const backgroundLayer = {
        id: "layer-1",
        name: "Background",
        visible: true,
        locked: false,
        isEmpty: false,
        image: null, // Background uses main image
        opacity: 100,
        filters: initialState,
      }
      allLayersToRender.push(backgroundLayer)
    }

    // Render layers in reverse order (last layer at bottom, first layer at top)
    // This allows proper transparency - bottom layers show through top layers
    // Since new layers are added to the beginning of the array, we need to render in reverse
    for (let i = allLayersToRender.length - 1; i >= 0; i--) {
      const layer = allLayersToRender[i]
      const setUniform1f = (name: string, value: number) => {
        const location = gl.getUniformLocation(program, name)
        if (location) gl.uniform1f(location, value)
      }

      const setUniformBool = (name: string, value: boolean) => {
        const location = gl.getUniformLocation(program, name)
        if (location) gl.uniform1i(location, value ? 1 : 0)
      }

      const setUniform2f = (name: string, x: number, y: number) => {
        const location = gl.getUniformLocation(program, name)
        if (location) gl.uniform2f(location, x, y)
      }

      // Get layer dimensions
      const layerDimensions = layerDimensionsRef.current.get(layer.id)
      if (!layerDimensions) {
        console.log(`Layer ${layer.id} dimensions not available yet, skipping`)
        continue
      }

      // Set layer-specific uniforms
      setUniform1f("u_brightness", layer.filters.brightness ?? 100)
      setUniform1f("u_contrast", layer.filters.contrast ?? 100)
      setUniform1f("u_saturation", layer.filters.saturation ?? 100)
      setUniform1f("u_hue", layer.filters.hue ?? 0)
      setUniform1f("u_exposure", layer.filters.exposure ?? 0)
      setUniform1f("u_temperature", layer.filters.temperature ?? 0)
      setUniform1f("u_gamma", layer.filters.gamma ?? 1)
      setUniform1f("u_vintage", layer.filters.vintage ?? 0)
      setUniform1f("u_blur", layer.filters.blur ?? 0)
      setUniform1f("u_blurType", layer.filters.blurType ?? 0)
      setUniform1f("u_blurDirection", layer.filters.blurDirection ?? 0)
      setUniform1f("u_blurCenter", layer.filters.blurCenter ?? 0)
      setUniform1f("u_invert", layer.filters.invert ?? 0)
      setUniform1f("u_sepia", layer.filters.sepia ?? 0)
      setUniform1f("u_grayscale", layer.filters.grayscale ?? 0)
      setUniform1f("u_tint", layer.filters.tint ?? 0)
      setUniform1f("u_vibrance", layer.filters.vibrance ?? 0)
      setUniform1f("u_noise", layer.filters.noise ?? 0)
      setUniform1f("u_grain", layer.filters.grain ?? 0)
      setUniform1f("u_rotate", layer.filters.rotate ?? 0)
      setUniform1f("u_scale", layer.filters.scale ?? 1)
      setUniformBool("u_flipHorizontal", layer.filters.flipHorizontal ?? false)
      setUniformBool("u_flipVertical", layer.filters.flipVertical ?? false)
      setUniform1f("u_opacity", layer.opacity)

      // Set layer dimensions and position
      setUniform2f("u_layerSize", layerDimensions.width, layerDimensions.height)
      setUniform2f("u_canvasSize", canvasWidth, canvasHeight)
      setUniform2f("u_layerPosition", layerDimensions.x, layerDimensions.y)

      // Set resolution
      const resolutionLocation = gl.getUniformLocation(program, "u_resolution")
      if (resolutionLocation)
        gl.uniform2f(
          resolutionLocation,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight
        )

      // Load and bind texture for this layer
      const layerTexture = await loadLayerTexture(layer)
      if (layerTexture) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, layerTexture)
        const samplerLocation = gl.getUniformLocation(program, "u_image")
        if (samplerLocation) gl.uniform1i(samplerLocation, 0)

        // Draw the layer
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    }

    // Disable blending after rendering
    gl.disable(gl.BLEND)
  }, [layers, loadLayerTexture, canvasRef?.current, imageUrl])

  React.useEffect(() => {
    draw()
  }, [draw])

  // Trigger redraw when layers change (for new dropped images)
  React.useEffect(() => {
    // Small delay to ensure layer dimensions are calculated
    const timer = setTimeout(() => {
      draw()
    }, 100)
    return () => clearTimeout(timer)
  }, [draw])

  React.useEffect(() => {
    onDrawReady?.(() => draw())
  }, [draw, onDrawReady])

  // Drag and drop handlers
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = e.currentTarget as HTMLCanvasElement
    canvas.style.border = "2px dashed #3b82f6"
    canvas.style.backgroundColor = "rgba(59, 130, 246, 0.1)"
    document.getElementById("drag-overlay")?.classList.remove("opacity-0")
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = e.currentTarget as HTMLCanvasElement
    canvas.style.border = ""
    canvas.style.backgroundColor = ""
    document.getElementById("drag-overlay")?.classList.add("opacity-0")
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Reset visual feedback
      const canvas = e.currentTarget as HTMLCanvasElement
      canvas.style.border = ""
      canvas.style.backgroundColor = ""
      document.getElementById("drag-overlay")?.classList.add("opacity-0")

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter((file) => file.type.startsWith("image/"))

      if (imageFiles.length > 0 && onImageDrop) {
        // Use the first image file
        console.log("Calling onImageDrop with:", imageFiles[0])
        onImageDrop(imageFiles[0])
      }
    },
    [onImageDrop]
  )

  return (
    <div
      ref={containerRef}
      className='relative  h-full overflow-hidden'
      // onMouseMove={handleMouseMove}
      // onMouseUp={handleMouseUp}
      // onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <motion.div
        className='relative'
        style={{
          x: transformX,
          y: transformY,
          scale: transformScale,
          transformOrigin: "0 0",
          width: canvasDimensions.width,
          height: canvasDimensions.height,
        }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "cursor-grab active:cursor-grabbing transition-all duration-200"
          )}
          style={{
            width: canvasDimensions.width,
            height: canvasDimensions.height,
            backgroundColor: "transparent",
            display: "block",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          title='Drop image files here to add them as new layers'
          {...props}
          id='image-editor-canvas'
        />
      </motion.div>
      {processing > 0 && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='text-sm '>Upscaling {processing}%</div>
        </div>
      )}
      {/* Drag overlay indicator */}
      <div
        className='absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 transition-opacity duration-200'
        id='drag-overlay'
        style={{
          width: canvasDimensions.width,
          height: canvasDimensions.height,
        }}
      >
        <div className='bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg p-8 text-center backdrop-blur-sm'>
          <div className='text-blue-600 font-medium text-lg'>
            Drop image to add as new layer
          </div>
          <div className='text-blue-500 text-sm mt-2'>
            Supports: JPG, PNG, GIF, WebP
          </div>
        </div>
      </div>
    </div>
  )
}
