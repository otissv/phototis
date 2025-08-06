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
import { HybridRenderer } from "@/lib/shaders/hybrid-renderer"

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
  const hybridRendererRef = React.useRef<HybridRenderer | null>(null)
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

  // Initialize hybrid renderer
  React.useEffect(() => {
    if (!canvasRef?.current || !glRef.current) return

    const canvas = canvasRef.current
    const gl = glRef.current

    // Use canvas dimensions instead of canvas element size
    const width = canvasDimensions.width
    const height = canvasDimensions.height

    console.log(
      "Initializing hybrid renderer with dimensions:",
      width,
      "x",
      height
    )

    if (!hybridRendererRef.current) {
      hybridRendererRef.current = new HybridRenderer()
    }

    const success = hybridRendererRef.current.initialize({
      gl,
      width,
      height,
    })

    if (!success) {
      console.error("Failed to initialize hybrid renderer")
    } else {
      console.log("Hybrid renderer initialized successfully")
    }
  }, [canvasRef?.current, canvasDimensions])

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

  // Cleanup hybrid renderer on unmount
  React.useEffect(() => {
    return () => {
      if (hybridRendererRef.current) {
        hybridRendererRef.current.cleanup()
        hybridRendererRef.current = null
      }
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
      console.log(
        "Updating canvas size from",
        canvas.width,
        "x",
        canvas.height,
        "to",
        canvasDimensions.width,
        "x",
        canvasDimensions.height
      )

      // Update canvas size
      canvas.width = canvasDimensions.width
      canvas.height = canvasDimensions.height

      // Update WebGL viewport
      gl.viewport(0, 0, canvasDimensions.width, canvasDimensions.height)

      console.log("Canvas size updated to:", canvas.width, "x", canvas.height)
      console.log(
        "Canvas style size after update:",
        canvas.style.width,
        "x",
        canvas.style.height
      )
    }
  }, [canvasDimensions, canvasRef?.current])

  // Helper function to load image data directly from File objects
  const loadImageDataFromFile = React.useCallback(
    async (file: File): Promise<ImageData | null> => {
      return new Promise((resolve) => {
        console.log(
          `Starting to load image file:`,
          file.name,
          file.size,
          file.type
        )
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          console.log(`Failed to get 2D context for file:`, file.name)
          resolve(null)
          return
        }

        const img = new Image()
        img.onload = () => {
          console.log(
            `Image loaded successfully:`,
            file.name,
            img.width,
            "x",
            img.height
          )
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, img.width, img.height)
          console.log(
            `Image data created:`,
            file.name,
            imageData.width,
            "x",
            imageData.height
          )
          resolve(imageData)
        }
        img.onerror = (error) => {
          console.log(`Failed to load image:`, file.name, error)
          resolve(null)
        }
        img.src = URL.createObjectURL(file)
      })
    },
    []
  )

  // Handle main image data loading
  React.useEffect(() => {
    const loadMainImage = async () => {
      if (!image) {
        console.log("No main image provided")
        return
      }

      console.log("Loading main image:", image.name)
      const imageData = await loadImageDataFromFile(image)
      if (imageData) {
        console.log(
          "Main image loaded successfully:",
          imageData.width,
          "x",
          imageData.height
        )
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
      } else {
        console.log("Failed to load main image")
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
      const currentLayerIds = new Set(layers.map((layer: Layer) => layer.id))
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
          console.log(
            `Loading image for layer ${layer.id}:`,
            layer.image.name,
            layer.image.size,
            layer.image.type
          )
          const imageData = await loadImageDataFromFile(layer.image)
          if (imageData) {
            console.log(
              `Successfully loaded image for layer ${layer.id}:`,
              imageData.width,
              "x",
              imageData.height
            )
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
    console.log("Canvas element:", canvas)
    console.log("Canvas size:", canvas.width, "x", canvas.height)
    console.log(
      "Canvas style size:",
      canvas.style.width,
      "x",
      canvas.style.height
    )

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
    console.log("WebGL context created successfully")
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

      console.log(`loadLayerTexture called for layer: ${layer.id}`)

      // Check if we already have a cached texture for this layer
      if (textureCacheRef.current.has(layer.id)) {
        console.log(`Using cached texture for layer: ${layer.id}`)
        return textureCacheRef.current.get(layer.id) || null
      }

      // Get image data for this layer
      const imageData = imageDataCacheRef.current.get(layer.id)
      console.log(`Image data for layer ${layer.id}:`, !!imageData)

      if (imageData) {
        console.log(
          `Creating texture for layer ${layer.id} with image data:`,
          imageData.width,
          "x",
          imageData.height
        )
        console.log(`Image data first few pixels:`, imageData.data.slice(0, 16))
        const texture = createTextureFromImageData(imageData)
        if (texture) {
          textureCacheRef.current.set(layer.id, texture)
          console.log(`Created texture for layer: ${layer.id}`)
          return texture
        }
      }

      // For background layer, try to use main image data
      if (layer.id === "layer-1") {
        const mainImageData = imageDataCacheRef.current.get("main")
        console.log(`Main image data for background layer:`, !!mainImageData)
        if (mainImageData) {
          const texture = createTextureFromImageData(mainImageData)
          if (texture) {
            textureCacheRef.current.set(layer.id, texture)
            console.log(`Created texture for background layer from main data`)
            return texture
          }
        }
      }

      // Fallback to main texture
      console.log(`Using fallback texture for layer: ${layer.id}`)
      return textureRef.current
    },
    [createTextureFromImageData]
  )

  // Draw function using hybrid renderer for proper layer compositing
  const draw = React.useCallback(async () => {
    // Prevent drawing during drag operations or if already drawing
    if (isDragActive || isDrawingRef.current) return

    // Set drawing flag to prevent overlapping draws
    isDrawingRef.current = true

    const gl = glRef.current
    const canvas = canvasRef?.current

    if (!gl || !canvas || !hybridRendererRef.current) {
      isDrawingRef.current = false
      return
    }

    try {
      // Get canvas dimensions
      const canvasWidth = canvas.width
      const canvasHeight = canvas.height

      // Get visible layers sorted from bottom to top
      const visibleLayers = layers.filter((layer) => {
        const isVisible = layer.visible && (!layer.isEmpty || layer.image)
        console.log(
          `Layer ${layer.id}: visible=${layer.visible}, isEmpty=${layer.isEmpty}, hasImage=${!!layer.image}, isVisible=${isVisible}`
        )
        return isVisible
      })

      console.log("Visible layers:", visibleLayers.length)
      console.log("All layers:", layers.length)
      console.log(
        "Background layer dimensions:",
        layerDimensionsRef.current.get("layer-1")
      )
      console.log("Has main image data:", imageDataCacheRef.current.has("main"))

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

        console.log("Background layer from system:", backgroundLayerFromSystem)

        if (backgroundLayerFromSystem?.visible) {
          allLayersToRender.push(backgroundLayerFromSystem)
          console.log("Added background layer from system")
        } else if (
          backgroundLayerFromSystem &&
          !backgroundLayerFromSystem.visible
        ) {
          // Background layer exists but is not visible, so don't render it
          console.log("Background layer exists but is not visible")
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
            blendMode: "normal" as const,
          }
          allLayersToRender.push(backgroundLayer)
          console.log("Added fallback background layer")
        }
      }

      console.log("Final layers to render:", allLayersToRender.length)

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

      // Create a map of layer textures
      const layerTextures = new Map<string, WebGLTexture>()

      // Load textures for all visible layers
      for (const layer of allLayersToRender) {
        console.log(`Loading texture for layer: ${layer.id}`)
        console.log(`Layer has image: ${!!layer.image}`)
        console.log(`Layer isEmpty: ${layer.isEmpty}`)

        const layerTexture = await loadLayerTexture(layer)
        if (layerTexture) {
          layerTextures.set(layer.id, layerTexture)
          console.log(`Successfully loaded texture for layer: ${layer.id}`)
        } else {
          console.log(`Failed to load texture for layer: ${layer.id}`)
        }
      }

      // Use hybrid renderer to render all layers with proper compositing
      if (
        hybridRendererRef.current &&
        allLayersToRender.length > 0 &&
        layerTextures.size > 0
      ) {
        try {
          console.log("Using hybrid renderer")

          // Skip test renders for now to focus on main functionality

          console.log(
            "Starting renderLayers with",
            allLayersToRender.length,
            "layers"
          )
          hybridRendererRef.current.renderLayers(
            allLayersToRender,
            layerTextures,
            renderingToolsValues,
            selectedLayerId,
            canvasWidth,
            canvasHeight
          )

          console.log("renderLayers completed, calling renderToCanvas")
          // Render the final result to canvas
          hybridRendererRef.current.renderToCanvas(canvas)
          console.log("renderToCanvas completed")
        } catch (error) {
          console.error("Error in hybrid renderer:", error)
          // Fallback: Clear canvas if hybrid renderer fails
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
        }
      } else {
        // Fallback: Clear canvas if no layers or renderer
        console.log("No layers or renderer available, clearing canvas")
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
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
    smoothToolsValues,
    selectedLayerId,
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
          width={canvasDimensions.width}
          height={canvasDimensions.height}
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
