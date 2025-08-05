"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { motion, useMotionValue, useTransform } from "motion/react"
import { useDebounce } from "use-debounce"

import type { ImageEditorToolsState } from "@/components/image-editor/state.image-editor"
import { initialState } from "@/components/image-editor/state.image-editor"
import { upscaleTool } from "./tools/upscaler"
import type { Layer } from "./layer-system"
import { ShaderManager } from "@/lib/shaders"

// Shader manager instance
const shaderManager = new ShaderManager()

export interface ImageEditorCanvasProps
  extends Omit<React.ComponentProps<"canvas">, "onProgress"> {
  image: File | null
  toolsValues: ImageEditorToolsState
  layers?: Layer[]
  onProgress?: (progress: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  onDrawReady?: (draw: () => void) => void
  onImageDrop?: (file: File) => void
  isDragActive?: boolean
  selectedLayerId: string
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
  isDragActive,
  selectedLayerId,
  ...props
}: ImageEditorCanvasProps) {
  const glRef = React.useRef<WebGL2RenderingContext | null>(null)
  const programRef = React.useRef<WebGLProgram | null>(null)
  const textureRef = React.useRef<WebGLTexture | null>(null)
  const positionBufferRef = React.useRef<WebGLBuffer | null>(null)
  const texCoordBufferRef = React.useRef<WebGLBuffer | null>(null)
  const [processing, setProcessing] = React.useState(0)
  const [isElementDragging, setIsElementDragging] = React.useState(false)

  // Direct image data cache for WebGL textures
  const imageDataCacheRef = React.useRef<Map<string, ImageData>>(new Map())
  const textureCacheRef = React.useRef<Map<string, WebGLTexture>>(new Map())

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

  // Debounce tool values to prevent excessive redraws
  const [debouncedToolsValues] = useDebounce(toolsValues, 100) // Increased from 50ms to 100ms

  // Add throttling for rapid value changes
  const [throttledToolsValues] = useDebounce(toolsValues, 16) // ~60fps throttling

  // Cache for layer-specific tool values to avoid recalculations
  const layerToolValuesCache = React.useRef<Map<string, any>>(new Map())

  // Track if we're currently drawing to prevent overlapping draws
  const isDrawingRef = React.useRef(false)

  // Smooth transition state for tool values
  const [smoothToolsValues, setSmoothToolsValues] =
    React.useState<ImageEditorToolsState>(toolsValues)
  const animationRef = React.useRef<Map<string, number>>(new Map())

  // Animate tool values smoothly when they change
  React.useEffect(() => {
    const toolKeys = Object.keys(toolsValues) as (keyof typeof toolsValues)[]

    toolKeys.forEach((key) => {
      if (typeof toolsValues[key] === "number") {
        const currentValue = smoothToolsValues[key] as number
        const targetValue = toolsValues[key] as number

        if (currentValue !== targetValue) {
          // Cancel any existing animation for this tool
          const existingAnimation = animationRef.current.get(key)
          if (existingAnimation) {
            cancelAnimationFrame(existingAnimation)
          }

          // Start smooth animation
          const startTime = performance.now()
          const duration = 300 // 300ms for smooth transition

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Ease out function for smooth deceleration
            const easeOut = 1 - (1 - progress) ** 3

            const newValue =
              currentValue + (targetValue - currentValue) * easeOut

            setSmoothToolsValues((prev) => ({
              ...prev,
              [key]: newValue,
            }))

            if (progress < 1) {
              const animationId = requestAnimationFrame(animate)
              animationRef.current.set(key, animationId)
            } else {
              animationRef.current.delete(key)
            }
          }

          const animationId = requestAnimationFrame(animate)
          animationRef.current.set(key, animationId)
        }
      }
    })
  }, [toolsValues, smoothToolsValues])

  // Cleanup animations on unmount
  React.useEffect(() => {
    return () => {
      animationRef.current.forEach((animationId) => {
        cancelAnimationFrame(animationId)
      })
      animationRef.current.clear()
    }
  }, [])

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

  // Helper function to load image data directly from File objects
  const loadImageDataFromFile = React.useCallback(
    async (file: File): Promise<ImageData | null> => {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(null)
          return
        }

        const img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, img.width, img.height)
          resolve(imageData)
        }
        img.onerror = () => resolve(null)
        img.src = URL.createObjectURL(file)
      })
    },
    []
  )

  // Handle main image data loading
  React.useEffect(() => {
    const loadMainImage = async () => {
      if (!image) return

      const imageData = await loadImageDataFromFile(image)
      if (imageData) {
        imageDataCacheRef.current.set("main", imageData)

        // Store dimensions for the background layer
        layerDimensionsRef.current.set("layer-1", {
          width: imageData.width,
          height: imageData.height,
          x: 0,
          y: 0,
        })

        // Update canvas dimensions
        setCanvasDimensions({
          width: imageData.width,
          height: imageData.height,
        })
      }
    }

    loadMainImage()
  }, [image, loadImageDataFromFile])

  // Handle layer-specific image data loading
  React.useEffect(() => {
    // Prevent updates during drag operations
    if (isDragActive) return

    const loadLayerImages = async () => {
      // Clean up old data
      const currentLayerIds = new Set(layers.map((layer) => layer.id))
      const oldData = new Map(imageDataCacheRef.current)

      for (const [layerId, imageData] of oldData) {
        if (!currentLayerIds.has(layerId) && layerId !== "main") {
          imageDataCacheRef.current.delete(layerId)
          textureCacheRef.current.delete(layerId)
          if (layerId !== "layer-1") {
            layerDimensionsRef.current.delete(layerId)
          }
        }
      }

      // Load new layer images
      for (const layer of layers) {
        if (layer.image && !imageDataCacheRef.current.has(layer.id)) {
          const imageData = await loadImageDataFromFile(layer.image)
          if (imageData) {
            imageDataCacheRef.current.set(layer.id, imageData)

            // Calculate layer dimensions
            const currentCanvasWidth = canvasDimensions.width
            const currentCanvasHeight = canvasDimensions.height

            let centerX = 0
            let centerY = 0

            if (layer.id !== "layer-1") {
              // Center new layers on the current canvas
              centerX = Math.max(0, (currentCanvasWidth - imageData.width) / 2)
              centerY = Math.max(
                0,
                (currentCanvasHeight - imageData.height) / 2
              )
            }

            const dimensions: LayerDimensions = {
              width: imageData.width,
              height: imageData.height,
              x: centerX,
              y: centerY,
            }
            layerDimensionsRef.current.set(layer.id, dimensions)

            // Update canvas dimensions to accommodate all layers
            const newDimensions = calculateOptimalCanvasSize()
          }
        }
      }
    }

    loadLayerImages()
  }, [
    layers,
    canvasDimensions,
    calculateOptimalCanvasSize,
    isDragActive,
    loadImageDataFromFile,
  ])

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
    if (!canvasRef?.current) return

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

    // Set WebGL to flip textures vertically (WebGL Y-axis is inverted)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    // Initialize Shader Manager
    if (!shaderManager.initialize(gl)) {
      console.error("Failed to initialize shader manager")
      return
    }

    const program = shaderManager.getProgram()
    if (!program) {
      console.error("Failed to get shader program")
      return
    }
    programRef.current = program

    // Buffer Creation and Setup
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    positionBufferRef.current = positionBuffer

    const texCoordBuffer = gl.createBuffer()
    if (!texCoordBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    )
    texCoordBufferRef.current = texCoordBuffer

    // Texture Creation and Setup
    const texture = gl.createTexture()
    if (!texture) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    textureRef.current = texture

    // Cleanup Function
    return () => {
      if (glRef.current) {
        shaderManager.cleanup()
        if (positionBufferRef.current) {
          gl.deleteBuffer(positionBufferRef.current)
          positionBufferRef.current = null
        }
        if (texCoordBufferRef.current) {
          gl.deleteBuffer(texCoordBufferRef.current)
          texCoordBufferRef.current = null
        }
        if (textureRef.current) {
          gl.deleteTexture(textureRef.current)
          textureRef.current = null
        }
        glRef.current = null
      }
    }
  }, [canvasRef?.current])

  // Helper function to create WebGL texture from ImageData
  const createTextureFromImageData = React.useCallback(
    (imageData: ImageData): WebGLTexture | null => {
      const gl = glRef.current
      if (!gl) return null

      const texture = gl.createTexture()
      if (!texture) return null

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      // Upload image data directly to GPU
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData
      )

      return texture
    },
    []
  )

  // Helper function to load texture for a layer
  const loadLayerTexture = React.useCallback(
    async (layer: Layer): Promise<WebGLTexture | null> => {
      const gl = glRef.current
      if (!gl) return null

      // Check if we already have a cached texture for this layer
      if (textureCacheRef.current.has(layer.id)) {
        return textureCacheRef.current.get(layer.id) || null
      }

      // Get image data for this layer
      const imageData = imageDataCacheRef.current.get(layer.id)
      if (imageData) {
        const texture = createTextureFromImageData(imageData)
        if (texture) {
          textureCacheRef.current.set(layer.id, texture)
          return texture
        }
      }

      // Fallback to main texture
      return textureRef.current
    },
    [createTextureFromImageData]
  )

  // Draw function for multi-layer rendering with direct WebGL data
  const draw = React.useCallback(async () => {
    // Prevent drawing during drag operations or if already drawing
    if (isDragActive || isDrawingRef.current) return

    // Set drawing flag to prevent overlapping draws
    isDrawingRef.current = true

    const gl = glRef.current
    const program = programRef.current
    const positionBuffer = positionBufferRef.current
    const texCoordBuffer = texCoordBufferRef.current
    const texture = textureRef.current

    if (!gl || !program || !positionBuffer || !texCoordBuffer || !texture) {
      isDrawingRef.current = false
      return
    }

    try {
      gl.useProgram(program)

      // Set position attribute
      const positionLocation = gl.getAttribLocation(program, "a_position")
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

      // Set texCoord attribute
      const texCoordLocation = gl.getAttribLocation(program, "a_texCoord")
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
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
      const backgroundLayerDimensions =
        layerDimensionsRef.current.get("layer-1")
      const hasBackgroundLayer =
        backgroundLayerDimensions && imageDataCacheRef.current.has("main")

      // Create a complete list of layers to render
      const allLayersToRender = [...visibleLayers]

      // Add background layer if it exists, isn't already in the list, and is visible
      if (
        hasBackgroundLayer &&
        !allLayersToRender.find((layer) => layer.id === "layer-1")
      ) {
        const backgroundLayerFromSystem = layers.find(
          (layer) => layer.id === "layer-1"
        )

        if (backgroundLayerFromSystem?.visible) {
          allLayersToRender.push(backgroundLayerFromSystem)
        } else if (
          backgroundLayerFromSystem &&
          !backgroundLayerFromSystem.visible
        ) {
          // Background layer exists but is not visible, so don't render it
        } else {
          // Fallback to creating a background layer object for rendering
          const backgroundLayer = {
            id: "layer-1",
            name: "Background",
            visible: true,
            locked: false,
            isEmpty: false,
            image: null,
            opacity: 100,
            filters: initialState,
          }
          allLayersToRender.push(backgroundLayer)
        }
      }

      // If no layers are visible, just clear the canvas and return
      if (allLayersToRender.length === 0) {
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
      }

      // Use throttled values for immediate feedback during dragging
      const activeToolsValues = isDragActive
        ? throttledToolsValues
        : debouncedToolsValues

      // Use smooth values for rendering
      const renderingToolsValues = smoothToolsValues

      // Render layers in reverse order (last layer at bottom, first layer at top)
      for (let i = allLayersToRender.length - 1; i >= 0; i--) {
        const layer = allLayersToRender[i]

        // Get layer dimensions
        const layerDimensions = layerDimensionsRef.current.get(layer.id)
        if (!layerDimensions) {
          continue
        }

        // Cache layer tool values to avoid recalculations
        const cacheKey = `${layer.id}-${JSON.stringify(renderingToolsValues)}`
        let cachedValues = layerToolValuesCache.current.get(cacheKey)

        if (!cachedValues) {
          cachedValues = {
            // Color adjustments
            brightness:
              layer.id === selectedLayerId
                ? (renderingToolsValues.brightness ??
                  layer.filters.brightness ??
                  100)
                : (layer.filters.brightness ?? 100),
            contrast:
              layer.id === selectedLayerId
                ? (renderingToolsValues.contrast ??
                  layer.filters.contrast ??
                  100)
                : (layer.filters.contrast ?? 100),
            saturation:
              layer.id === selectedLayerId
                ? (renderingToolsValues.saturation ??
                  layer.filters.saturation ??
                  100)
                : (layer.filters.saturation ?? 100),
            hue:
              layer.id === selectedLayerId
                ? (renderingToolsValues.hue ?? layer.filters.hue ?? 0)
                : (layer.filters.hue ?? 0),
            exposure:
              layer.id === selectedLayerId
                ? (renderingToolsValues.exposure ?? layer.filters.exposure ?? 0)
                : (layer.filters.exposure ?? 0),
            temperature:
              layer.id === selectedLayerId
                ? (renderingToolsValues.temperature ??
                  layer.filters.temperature ??
                  0)
                : (layer.filters.temperature ?? 0),
            gamma:
              layer.id === selectedLayerId
                ? (renderingToolsValues.gamma ?? layer.filters.gamma ?? 1)
                : (layer.filters.gamma ?? 1),

            // Blur effects
            blur:
              layer.id === selectedLayerId
                ? (renderingToolsValues.blur ?? layer.filters.blur ?? 0)
                : (layer.filters.blur ?? 0),
            blurType:
              layer.id === selectedLayerId
                ? (renderingToolsValues.blurType ?? layer.filters.blurType ?? 0)
                : (layer.filters.blurType ?? 0),
            blurDirection:
              layer.id === selectedLayerId
                ? (renderingToolsValues.blurDirection ??
                  layer.filters.blurDirection ??
                  0)
                : (layer.filters.blurDirection ?? 0),
            blurCenter:
              layer.id === selectedLayerId
                ? (renderingToolsValues.blurCenter ??
                  layer.filters.blurCenter ??
                  0)
                : (layer.filters.blurCenter ?? 0),

            // Artistic effects
            vintage:
              layer.id === selectedLayerId
                ? (renderingToolsValues.vintage ?? layer.filters.vintage ?? 0)
                : (layer.filters.vintage ?? 0),
            invert:
              layer.id === selectedLayerId
                ? (renderingToolsValues.invert ?? layer.filters.invert ?? 0)
                : (layer.filters.invert ?? 0),
            sepia:
              layer.id === selectedLayerId
                ? (renderingToolsValues.sepia ?? layer.filters.sepia ?? 0)
                : (layer.filters.sepia ?? 0),
            grayscale:
              layer.id === selectedLayerId
                ? (renderingToolsValues.grayscale ??
                  layer.filters.grayscale ??
                  0)
                : (layer.filters.grayscale ?? 0),
            tint:
              layer.id === selectedLayerId
                ? (renderingToolsValues.tint ?? layer.filters.tint ?? 0)
                : (layer.filters.tint ?? 0),
            vibrance:
              layer.id === selectedLayerId
                ? (renderingToolsValues.vibrance ?? layer.filters.vibrance ?? 0)
                : (layer.filters.vibrance ?? 0),
            noise:
              layer.id === selectedLayerId
                ? (renderingToolsValues.noise ?? layer.filters.noise ?? 0)
                : (layer.filters.noise ?? 0),
            grain:
              layer.id === selectedLayerId
                ? (renderingToolsValues.grain ?? layer.filters.grain ?? 0)
                : (layer.filters.grain ?? 0),

            // Transformations
            rotate:
              layer.id === selectedLayerId
                ? (renderingToolsValues.rotate ?? layer.filters.rotate ?? 0)
                : (layer.filters.rotate ?? 0),
            scale:
              layer.id === selectedLayerId
                ? (renderingToolsValues.scale ?? layer.filters.scale ?? 1)
                : (layer.filters.scale ?? 1),
            flipHorizontal:
              layer.id === selectedLayerId
                ? (renderingToolsValues.flipHorizontal ??
                  layer.filters.flipHorizontal ??
                  false)
                : (layer.filters.flipHorizontal ?? false),
            flipVertical:
              layer.id === selectedLayerId
                ? (renderingToolsValues.flipVertical ??
                  layer.filters.flipVertical ??
                  false)
                : (layer.filters.flipVertical ?? false),
            opacity: layer.opacity,

            // Layer positioning
            layerSize: [layerDimensions.width, layerDimensions.height] as [
              number,
              number,
            ],
            canvasSize: [canvasWidth, canvasHeight] as [number, number],
            layerPosition: [layerDimensions.x, layerDimensions.y] as [
              number,
              number,
            ],
          }

          // Cache the calculated values
          layerToolValuesCache.current.set(cacheKey, cachedValues)

          // Limit cache size to prevent memory leaks
          if (layerToolValuesCache.current.size > 100) {
            const firstKey = layerToolValuesCache.current.keys().next().value
            if (firstKey) {
              layerToolValuesCache.current.delete(firstKey)
            }
          }
        }

        // Update shader manager with cached values
        shaderManager.updateUniforms(cachedValues)

        // Set all uniforms using the shader manager
        shaderManager.setUniforms(gl, program)

        // Set resolution
        const resolutionLocation = gl.getUniformLocation(
          program,
          "u_resolution"
        )
        if (resolutionLocation) {
          gl.uniform2f(
            resolutionLocation,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight
          )
        }

        // Load and bind texture for this layer
        const layerTexture = await loadLayerTexture(layer)
        if (layerTexture) {
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, layerTexture)
          const samplerLocation = gl.getUniformLocation(program, "u_image")
          if (samplerLocation) gl.uniform1i(samplerLocation, 0)

          // Draw the layer
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        } else {
          // Fallback to main texture if layer texture is not available
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          const samplerLocation = gl.getUniformLocation(program, "u_image")
          if (samplerLocation) gl.uniform1i(samplerLocation, 0)

          // Draw the layer
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }
      }

      // Disable blending after rendering
      gl.disable(gl.BLEND)
    } finally {
      // Always reset the drawing flag
      isDrawingRef.current = false
    }
  }, [
    layers,
    loadLayerTexture,
    canvasRef?.current,
    isDragActive,
    debouncedToolsValues,
    throttledToolsValues,
    selectedLayerId,
    smoothToolsValues,
  ])

  React.useEffect(() => {
    // Only draw if WebGL objects are ready
    if (
      glRef.current &&
      programRef.current &&
      positionBufferRef.current &&
      texCoordBufferRef.current &&
      textureRef.current
    ) {
      draw()
    }
  }, [draw])

  // Trigger redraw when layers change (for new dropped images)
  React.useEffect(() => {
    // Prevent updates during drag operations
    if (isDragActive) return

    // Only redraw if WebGL objects are ready
    if (
      !glRef.current ||
      !programRef.current ||
      !positionBufferRef.current ||
      !texCoordBufferRef.current ||
      !textureRef.current
    ) {
      return
    }

    // Small delay to ensure layer dimensions are calculated
    const timer = setTimeout(() => {
      draw()
    }, 100)
    return () => clearTimeout(timer)
  }, [draw, isDragActive])

  React.useEffect(() => {
    onDrawReady?.(() => draw())
  }, [draw, onDrawReady])

  // Drag and drop handlers
  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      if (isElementDragging) return
      e.preventDefault()
      e.stopPropagation()
      const canvas = e.currentTarget as HTMLCanvasElement
      canvas.style.border = "2px dashed #3b82f6"
      canvas.style.backgroundColor = "rgba(59, 130, 246, 0.1)"
      document.getElementById("drag-overlay")?.classList.remove("opacity-0")
    },
    [isElementDragging]
  )

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent) => {
      if (isElementDragging) return
      e.preventDefault()
      e.stopPropagation()
      const canvas = e.currentTarget as HTMLCanvasElement
      canvas.style.border = ""
      canvas.style.backgroundColor = ""
      document.getElementById("drag-overlay")?.classList.add("opacity-0")
    },
    [isElementDragging]
  )

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (isElementDragging) return
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
        onImageDrop(imageFiles[0])
      }
    },
    [onImageDrop, isElementDragging]
  )

  return (
    <div
      ref={containerRef}
      className='relative  h-full overflow-hidden'
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
          className={cn("transition-all duration-200")}
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
        {/* Drag overlay indicator */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 transition-opacity duration-200",
            "bg-blue-500/20 border-dashed border-blue-500 backdrop-blur-sm",
            "ring-inset ring-1 ring-blue-500"
          )}
          id='drag-overlay'
          style={{
            width: canvasDimensions.width,
            height: canvasDimensions.height,
          }}
        />
      </motion.div>
      {processing > 0 && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='text-sm '>Upscaling {processing}%</div>
        </div>
      )}
    </div>
  )
}
