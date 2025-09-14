// GPU Security utilities: dimension and filter parameter validation/clamping

// Keep only the comprehensive versions below to avoid duplicate exports

// GPU Security utilities for validating operations and preventing memory issues
// Implements security measures for WebGL operations in workers

// Security constants
export const GPU_SECURITY_CONSTANTS = {
  MAX_CANVAS_DIMENSION: 16384,

  // Maximum texture dimensions
  MAX_TEXTURE_SIZE: 16384,

  // Maximum blur kernel size to prevent GPU memory exhaustion
  MAX_BLUR_KERNEL_SIZE: 256,

  // Maximum filter parameters
  MAX_BRIGHTNESS: 100,
  MAX_CONTRAST: 100,
  MAX_SATURATION: 200,
  MAX_HUE: 360,
  MAX_EXPOSURE: 100,
  MAX_TEMPERATURE: 100,
  MAX_GAMMA: 3.0,

  // Maximum artistic effect parameters
  MAX_VINTAGE: 100,
  MAX_INVERT: 100,
  MAX_SEPIA: 100,
  MAX_GRAYSCALE: 100,
  MAX_TINT: 100,
  MAX_VIBRANCE: 100,
  MAX_NOISE: 100,
  MAX_GRAIN: 100,

  // Maximum transformation parameters
  MAX_ROTATE: 360,
  MAX_SCALE: 5.0,

  // Memory limits - Updated to be less conservative for modern GPUs
  MAX_GPU_MEMORY_USAGE: 0.9, // Increased from 0.8 to 0.9 (90% of available GPU memory)
  MAX_TEXTURE_COUNT: 1000,
  MAX_FBO_COUNT: 100,
}

// GPU capability detection
export interface GPUCapabilities {
  maxTextureSize: number
  maxRenderbufferSize: number
  maxViewportDims: [number, number]
  maxVertexUniformVectors: number
  maxFragmentUniformVectors: number
  maxVaryingVectors: number
  maxVertexAttribs: number
  maxTextureImageUnits: number
  maxVertexTextureImageUnits: number
  maxCombinedTextureImageUnits: number
  // These are WebGL1 constants; in WebGL2 use UNIFORM_VECTORS variants
  maxVertexOutputVectors?: number
  maxFragmentInputVectors?: number
  minAliasedLineWidth: number
  maxAliasedLineWidth: number
  minAliasedPointSize: number
  maxAliasedPointSize: number
  maxViewportWidth: number
  maxViewportHeight: number
  maxDrawBuffers: number
  maxColorAttachments: number
  maxSamples: number
  estimatedGPUMemory?: number
}

// Detect GPU capabilities
export function detectGPUCapabilities(
  gl: WebGL2RenderingContext
): GPUCapabilities {
  const capabilities = {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
    maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
    maxVertexTextureImageUnits: gl.getParameter(
      gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS
    ),
    maxCombinedTextureImageUnits: gl.getParameter(
      gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS
    ),
    // Not present in WebGL2; leave undefined for compatibility
    maxVertexOutputVectors: 0,
    maxFragmentInputVectors: 0,
    minAliasedLineWidth: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[0],
    maxAliasedLineWidth: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[1],
    minAliasedPointSize: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[0],
    maxAliasedPointSize: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
    maxViewportWidth: gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0],
    maxViewportHeight: gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1],
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
    maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    estimatedGPUMemory: 0, // Initialize as undefined
  }

  // Estimate GPU memory based on texture size capabilities
  // This is a rough estimation - modern GPUs typically have 4GB+ memory
  // but we can make educated guesses based on texture size limits
  const maxTextureSize = capabilities.maxTextureSize
  if (maxTextureSize >= 16384) {
    // 16K+ texture support suggests 8GB+ GPU memory (increased from 4GB)
    capabilities.estimatedGPUMemory = 8 * 1024 * 1024 * 1024 // 8GB
  } else if (maxTextureSize >= 8192) {
    // 8K+ texture support suggests 4GB+ GPU memory (increased from 2GB)
    capabilities.estimatedGPUMemory = 4 * 1024 * 1024 * 1024 // 4GB
  } else if (maxTextureSize >= 4096) {
    // 4K+ texture support suggests 2GB+ GPU memory (increased from 1GB)
    capabilities.estimatedGPUMemory = 2 * 1024 * 1024 * 1024 // 2GB
  } else {
    // Fallback to more generous estimate for older systems
    capabilities.estimatedGPUMemory = 1 * 1024 * 1024 * 1024 // 1GB (increased from 512MB)
  }

  return capabilities
}

// Validate image dimensions
export function validateImageDimensions(
  width: number,
  height: number,
  capabilities?: GPUCapabilities
): {
  isValid: boolean
  error?: string
  adjustedWidth?: number
  adjustedHeight?: number
} {
  // Basic validation
  if (width <= 0 || height <= 0) {
    return {
      isValid: false,
      error: "Image dimensions must be positive",
    }
  }

  // Check against security constants
  if (
    width > GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE ||
    height > GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
  ) {
    return {
      isValid: false,
      error: `Image dimensions exceed maximum texture size (${GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE})`,
    }
  }

  // Calculate memory usage and apply memory limit
  const pixelCount = width * height
  const bytesPerPixel = 4 // RGBA
  const estimatedMemoryBytes = pixelCount * bytesPerPixel

  // Use detected GPU memory or fallback to more generous estimates for modern systems
  let gpuMemory: number
  if (capabilities?.estimatedGPUMemory) {
    gpuMemory = capabilities.estimatedGPUMemory
  } else {
    // More generous fallback estimates for modern GPUs
    const maxTextureSize =
      capabilities?.maxTextureSize || GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    if (maxTextureSize >= 16384) {
      gpuMemory = 8 * 1024 * 1024 * 1024 // 8GB (increased from 4GB)
    } else if (maxTextureSize >= 8192) {
      gpuMemory = 4 * 1024 * 1024 * 1024 // 4GB (increased from 2GB)
    } else if (maxTextureSize >= 4096) {
      gpuMemory = 2 * 1024 * 1024 * 1024 // 2GB (increased from 1GB)
    } else {
      gpuMemory = 1 * 1024 * 1024 * 1024 // 1GB (increased from 512MB)
    }
  }

  const memoryLimit = gpuMemory * GPU_SECURITY_CONSTANTS.MAX_GPU_MEMORY_USAGE

  if (estimatedMemoryBytes > memoryLimit) {
    // Calculate adjusted dimensions that fit within memory limit
    const maxPixels = Math.floor(memoryLimit / bytesPerPixel)
    const aspectRatio = width / height

    let adjustedWidth: number
    let adjustedHeight: number

    if (aspectRatio >= 1) {
      // Landscape or square
      adjustedHeight = Math.floor(Math.sqrt(maxPixels / aspectRatio))
      adjustedWidth = Math.floor(adjustedHeight * aspectRatio)
    } else {
      // Portrait
      adjustedWidth = Math.floor(Math.sqrt(maxPixels * aspectRatio))
      adjustedHeight = Math.floor(adjustedWidth / aspectRatio)
    }

    // Ensure adjusted dimensions don't exceed maximum texture size
    adjustedWidth = Math.min(
      adjustedWidth,
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    )
    adjustedHeight = Math.min(
      adjustedHeight,
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    )

    return {
      isValid: false,
      error: `Image dimensions exceed GPU memory limit (${(estimatedMemoryBytes / (1024 * 1024)).toFixed(1)}MB > ${(memoryLimit / (1024 * 1024)).toFixed(1)}MB). Consider resizing to ${adjustedWidth}x${adjustedHeight}`,
      adjustedWidth,
      adjustedHeight,
    }
  }

  // Check against GPU capabilities if provided
  if (capabilities) {
    const maxSize = Math.min(
      capabilities.maxTextureSize,
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    )

    if (width > maxSize || height > maxSize) {
      return {
        isValid: false,
        error: `Image dimensions exceed GPU maximum texture size (${maxSize})`,
      }
    }
  }

  return { isValid: true }
}

// Validate and clamp filter parameters
export function validateFilterParameters(parameters: any): {
  isValid: boolean
  validatedParameters: any
  errors: string[]
} {
  const validatedParameters = { ...parameters }
  const errors: string[] = []

  // Normalize solid adjustment if present: expects { solid: { value, color } }
  if (validatedParameters.solid !== undefined) {
    const solid = validatedParameters.solid
    if (
      typeof solid === "object" &&
      solid !== null &&
      typeof (solid as any).value === "number" &&
      typeof (solid as any).color === "string"
    ) {
      // Clamp opacity value 0..100
      const v = Math.max(0, Math.min(100, (solid as any).value))
      if (v !== (solid as any).value) {
        errors.push(`Solid.value clamped from ${(solid as any).value} to ${v}`)
      }
      // Parse hex color like #rrggbb or #rgb
      const hex = (solid as any).color.trim()
      const rgba = hexToRgba01(hex)
      if (!rgba) {
        errors.push(
          `Invalid solid.color '${(solid as any).color}', defaulting to #000000`
        )
      }
      const [r, g, b, a] = rgba || [0, 0, 0, 1]
      validatedParameters.u_solidEnabled = v > 0 ? 1 : 0
      validatedParameters.u_solidColor = [r, g, b]
      validatedParameters.u_solidAlpha = a
    } else if (typeof solid === "string") {
      const rgba = hexToRgba01(solid.trim()) || [0, 0, 0, 1]
      validatedParameters.u_solidEnabled = 1
      validatedParameters.u_solidColor = [rgba[0], rgba[1], rgba[2]]
      validatedParameters.u_solidAlpha = rgba[3]
    } else if (
      typeof solid === "object" &&
      solid !== null &&
      typeof (solid as any).color === "string"
    ) {
      const rgba = hexToRgba01((solid as any).color.trim()) || [0, 0, 0, 1]
      validatedParameters.u_solidEnabled = 1
      validatedParameters.u_solidColor = [rgba[0], rgba[1], rgba[2]]
      validatedParameters.u_solidAlpha = rgba[3]
    } else {
      // If malformed, disable
      validatedParameters.u_solidEnabled = 0
      errors.push("Solid adjustment malformed; disabled")
    }
  } else {
    validatedParameters.u_solidEnabled = 0
  }

  // Validate blur parameters
  if (validatedParameters.blur !== undefined) {
    const clampedBlur = Math.max(0, Math.min(validatedParameters.blur, 100))
    if (clampedBlur !== validatedParameters.blur) {
      errors.push(
        `Blur value clamped from ${validatedParameters.blur} to ${clampedBlur}`
      )
    }
    validatedParameters.blur = clampedBlur
  }

  if (validatedParameters.blurKernelSize !== undefined) {
    const clampedKernelSize = Math.max(
      1,
      Math.min(
        validatedParameters.blurKernelSize,
        GPU_SECURITY_CONSTANTS.MAX_BLUR_KERNEL_SIZE
      )
    )
    if (clampedKernelSize !== validatedParameters.blurKernelSize) {
      errors.push(
        `Blur kernel size clamped from ${validatedParameters.blurKernelSize} to ${clampedKernelSize}`
      )
    }
    validatedParameters.blurKernelSize = clampedKernelSize
  }

  // Validate color adjustment parameters
  if (validatedParameters.brightness !== undefined) {
    const clampedBrightness = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_BRIGHTNESS,
      Math.min(
        validatedParameters.brightness,
        GPU_SECURITY_CONSTANTS.MAX_BRIGHTNESS
      )
    )
    if (clampedBrightness !== validatedParameters.brightness) {
      errors.push(
        `Brightness value clamped from ${validatedParameters.brightness} to ${clampedBrightness}`
      )
    }
    validatedParameters.brightness = clampedBrightness
  }

  if (validatedParameters.contrast !== undefined) {
    const clampedContrast = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_CONTRAST,
      Math.min(
        validatedParameters.contrast,
        GPU_SECURITY_CONSTANTS.MAX_CONTRAST
      )
    )
    if (clampedContrast !== validatedParameters.contrast) {
      errors.push(
        `Contrast value clamped from ${validatedParameters.contrast} to ${clampedContrast}`
      )
    }
    validatedParameters.contrast = clampedContrast
  }

  if (validatedParameters.saturation !== undefined) {
    const clampedSaturation = Math.max(
      0,
      Math.min(
        validatedParameters.saturation,
        GPU_SECURITY_CONSTANTS.MAX_SATURATION
      )
    )
    if (clampedSaturation !== validatedParameters.saturation) {
      errors.push(
        `Saturation value clamped from ${validatedParameters.saturation} to ${clampedSaturation}`
      )
    }
    validatedParameters.saturation = clampedSaturation
  }

  if (validatedParameters.hue !== undefined) {
    const clampedHue = Math.max(
      0,
      Math.min(validatedParameters.hue, GPU_SECURITY_CONSTANTS.MAX_HUE)
    )
    if (clampedHue !== validatedParameters.hue) {
      errors.push(
        `Hue value clamped from ${validatedParameters.hue} to ${clampedHue}`
      )
    }
    validatedParameters.hue = clampedHue
  }

  if (validatedParameters.exposure !== undefined) {
    const clampedExposure = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_EXPOSURE,
      Math.min(
        validatedParameters.exposure,
        GPU_SECURITY_CONSTANTS.MAX_EXPOSURE
      )
    )
    if (clampedExposure !== validatedParameters.exposure) {
      errors.push(
        `Exposure value clamped from ${validatedParameters.exposure} to ${clampedExposure}`
      )
    }
    validatedParameters.exposure = clampedExposure
  }

  if (validatedParameters.temperature !== undefined) {
    const clampedTemperature = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_TEMPERATURE,
      Math.min(
        validatedParameters.temperature,
        GPU_SECURITY_CONSTANTS.MAX_TEMPERATURE
      )
    )
    if (clampedTemperature !== validatedParameters.temperature) {
      errors.push(
        `Temperature value clamped from ${validatedParameters.temperature} to ${clampedTemperature}`
      )
    }
    validatedParameters.temperature = clampedTemperature
  }

  if (validatedParameters.gamma !== undefined) {
    const clampedGamma = Math.max(
      0.1,
      Math.min(validatedParameters.gamma, GPU_SECURITY_CONSTANTS.MAX_GAMMA)
    )
    if (clampedGamma !== validatedParameters.gamma) {
      errors.push(
        `Gamma value clamped from ${validatedParameters.gamma} to ${clampedGamma}`
      )
    }
    validatedParameters.gamma = clampedGamma
  }

  // Validate artistic effect parameters
  if (validatedParameters.vintage !== undefined) {
    const clampedVintage = Math.max(
      0,
      Math.min(validatedParameters.vintage, GPU_SECURITY_CONSTANTS.MAX_VINTAGE)
    )
    if (clampedVintage !== validatedParameters.vintage) {
      errors.push(
        `Vintage value clamped from ${validatedParameters.vintage} to ${clampedVintage}`
      )
    }
    validatedParameters.vintage = clampedVintage
  }

  if (validatedParameters.invert !== undefined) {
    const clampedInvert = Math.max(
      0,
      Math.min(validatedParameters.invert, GPU_SECURITY_CONSTANTS.MAX_INVERT)
    )
    if (clampedInvert !== validatedParameters.invert) {
      errors.push(
        `Invert value clamped from ${validatedParameters.invert} to ${clampedInvert}`
      )
    }
    validatedParameters.invert = clampedInvert
  }

  if (validatedParameters.sepia !== undefined) {
    const clampedSepia = Math.max(
      0,
      Math.min(validatedParameters.sepia, GPU_SECURITY_CONSTANTS.MAX_SEPIA)
    )
    if (clampedSepia !== validatedParameters.sepia) {
      errors.push(
        `Sepia value clamped from ${validatedParameters.sepia} to ${clampedSepia}`
      )
    }
    validatedParameters.sepia = clampedSepia
  }

  if (validatedParameters.grayscale !== undefined) {
    const clampedGrayscale = Math.max(
      0,
      Math.min(
        validatedParameters.grayscale,
        GPU_SECURITY_CONSTANTS.MAX_GRAYSCALE
      )
    )
    if (clampedGrayscale !== validatedParameters.grayscale) {
      errors.push(
        `Grayscale value clamped from ${validatedParameters.grayscale} to ${clampedGrayscale}`
      )
    }
    validatedParameters.grayscale = clampedGrayscale
  }

  if (validatedParameters.colorize !== undefined) {
    const colorize = validatedParameters.colorize
    if (
      typeof colorize === "object" &&
      colorize !== null &&
      typeof (colorize as any).value === "number" &&
      typeof (colorize as any).color === "string"
    ) {
      const amt = Math.max(
        -GPU_SECURITY_CONSTANTS.MAX_TINT,
        Math.min((colorize as any).value, GPU_SECURITY_CONSTANTS.MAX_TINT)
      )
      if (amt !== (colorize as any).value) {
        errors.push(
          `Colorize.value clamped from ${(colorize as any).value} to ${amt}`
        )
      }
      const rgba = hexToRgba01((colorize as any).color.trim()) || [1, 0, 0, 1]
      validatedParameters.colorize = amt
      validatedParameters.u_recolorColor = [rgba[0], rgba[1], rgba[2]]
    } else if (typeof colorize === "number") {
      const clampedRecolor = Math.max(
        -GPU_SECURITY_CONSTANTS.MAX_TINT,
        Math.min(colorize, GPU_SECURITY_CONSTANTS.MAX_TINT)
      )
      if (clampedRecolor !== colorize) {
        errors.push(
          `Colorize value clamped from ${colorize} to ${clampedRecolor}`
        )
      }
      validatedParameters.colorize = clampedRecolor
      // Default colorize color to red if not provided
      validatedParameters.u_recolorColor = [1, 0, 0]
    }
  }

  // New Affinity-style colorize validation
  if (validatedParameters.recolorHue !== undefined) {
    // Allow -180..180 or 0..360; clamp to [-180,180]
    let h = Number(validatedParameters.recolorHue) || 0
    if (h > 180) h = ((h + 180) % 360) - 180
    if (h < -180) h = ((h - 180) % 360) + 180
    validatedParameters.recolorHue = h
  }
  if (validatedParameters.recolorSaturation !== undefined) {
    const s = Math.max(
      0,
      Math.min(100, Number(validatedParameters.recolorSaturation))
    )
    validatedParameters.recolorSaturation = s
  }
  if (validatedParameters.recolorLightness !== undefined) {
    const l = Math.max(
      0,
      Math.min(100, Number(validatedParameters.recolorLightness))
    )
    validatedParameters.recolorLightness = l
  }
  if (validatedParameters.recolorAmount !== undefined) {
    const a = Math.max(
      0,
      Math.min(100, Number(validatedParameters.recolorAmount))
    )
    validatedParameters.recolorAmount = a
  }
  if (validatedParameters.recolorPreserveLum !== undefined) {
    validatedParameters.recolorPreserveLum =
      !!validatedParameters.recolorPreserveLum
  }

  if (validatedParameters.vibrance !== undefined) {
    const clampedVibrance = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_VIBRANCE,
      Math.min(
        validatedParameters.vibrance,
        GPU_SECURITY_CONSTANTS.MAX_VIBRANCE
      )
    )
    if (clampedVibrance !== validatedParameters.vibrance) {
      errors.push(
        `Vibrance value clamped from ${validatedParameters.vibrance} to ${clampedVibrance}`
      )
    }
    validatedParameters.vibrance = clampedVibrance
  }

  if (validatedParameters.noise !== undefined) {
    const clampedNoise = Math.max(
      0,
      Math.min(validatedParameters.noise, GPU_SECURITY_CONSTANTS.MAX_NOISE)
    )
    if (clampedNoise !== validatedParameters.noise) {
      errors.push(
        `Noise value clamped from ${validatedParameters.noise} to ${clampedNoise}`
      )
    }
    validatedParameters.noise = clampedNoise
  }

  if (validatedParameters.grain !== undefined) {
    const clampedGrain = Math.max(
      0,
      Math.min(validatedParameters.grain, GPU_SECURITY_CONSTANTS.MAX_GRAIN)
    )
    if (clampedGrain !== validatedParameters.grain) {
      errors.push(
        `Grain value clamped from ${validatedParameters.grain} to ${clampedGrain}`
      )
    }
    validatedParameters.grain = clampedGrain
  }

  // Validate transformation parameters
  if (validatedParameters.rotate !== undefined) {
    const clampedRotate = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_ROTATE,
      Math.min(validatedParameters.rotate, GPU_SECURITY_CONSTANTS.MAX_ROTATE)
    )
    if (clampedRotate !== validatedParameters.rotate) {
      errors.push(
        `Rotate value clamped from ${validatedParameters.rotate} to ${clampedRotate}`
      )
    }
    validatedParameters.rotate = clampedRotate
  }

  if (validatedParameters.scale !== undefined) {
    const clampedScale = Math.max(
      0.01,
      Math.min(validatedParameters.scale, GPU_SECURITY_CONSTANTS.MAX_SCALE)
    )
    if (clampedScale !== validatedParameters.scale) {
      errors.push(
        `Scale value clamped from ${validatedParameters.scale} to ${clampedScale}`
      )
    }
    validatedParameters.scale = clampedScale
  }

  return {
    isValid: true,
    validatedParameters,
    errors,
  }
}

function hexToRgba01(hex: string): [number, number, number, number] | null {
  const m = hex.replace(/^#/, "").toLowerCase()
  if (m.length === 3) {
    const r = Number.parseInt(m[0] + m[0], 16)
    const g = Number.parseInt(m[1] + m[1], 16)
    const b = Number.parseInt(m[2] + m[2], 16)
    return [r / 255, g / 255, b / 255, 1]
  }
  if (m.length === 4) {
    const r = Number.parseInt(m[0] + m[0], 16)
    const g = Number.parseInt(m[1] + m[1], 16)
    const b = Number.parseInt(m[2] + m[2], 16)
    const a = Number.parseInt(m[3] + m[3], 16)
    return [r / 255, g / 255, b / 255, a / 255]
  }
  if (m.length === 6) {
    const r = Number.parseInt(m.slice(0, 2), 16)
    const g = Number.parseInt(m.slice(2, 4), 16)
    const b = Number.parseInt(m.slice(4, 6), 16)
    return [r / 255, g / 255, b / 255, 1]
  }
  if (m.length === 8) {
    const r = Number.parseInt(m.slice(0, 2), 16)
    const g = Number.parseInt(m.slice(2, 4), 16)
    const b = Number.parseInt(m.slice(4, 6), 16)
    const a = Number.parseInt(m.slice(6, 8), 16)
    return [r / 255, g / 255, b / 255, a / 255]
  }
  return null
}

// Validate shader source code for security
export function validateShaderSource(source: string): {
  isValid: boolean
  error?: string
} {
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /discard\s*\(/i, // Discard with parameters
    /gl_FragDepth\s*=/i, // Fragment depth assignment
    /gl_Position\s*=\s*vec4\s*\(/i, // Position assignment
    /texture\s*\(/i, // Texture sampling (should be allowed but monitored)
    /uniform\s+sampler/i, // Sampler uniforms
    /varying\s+/i, // Varying variables
    /attribute\s+/i, // Attribute variables
    /precision\s+/i, // Precision qualifiers
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(source)) {
      // These patterns are actually normal for shaders, so we'll just log them
      console.log(
        `Shader validation: Found pattern ${pattern.source} in shader`
      )
    }
  }

  // Check for truly dangerous patterns
  const maliciousPatterns = [
    /eval\s*\(/i, // eval() calls
    /Function\s*\(/i, // Function constructor
    /setTimeout\s*\(/i, // setTimeout calls
    /setInterval\s*\(/i, // setInterval calls
    /fetch\s*\(/i, // fetch calls
    /XMLHttpRequest/i, // XMLHttpRequest
    /localStorage/i, // localStorage access
    /sessionStorage/i, // sessionStorage access
    /document\s*\./i, // Document access
    /window\s*\./i, // Window access
  ]

  for (const pattern of maliciousPatterns) {
    if (pattern.test(source)) {
      return {
        isValid: false,
        error: `Potentially malicious code detected in shader: ${pattern.source}`,
      }
    }
  }

  return { isValid: true }
}

// Monitor GPU memory usage
export function estimateGPUMemoryUsage(
  textureCount: number,
  textureSizes: number[],
  fboCount: number,
  fboSizes: number[]
): {
  estimatedUsage: number
  isWithinLimits: boolean
  warning?: string
} {
  // Rough estimation of GPU memory usage
  let totalMemory = 0

  // Calculate texture memory
  for (let i = 0; i < textureCount; i++) {
    const size = textureSizes[i] || 1024 * 1024 // Default 1MB per texture
    totalMemory += size
  }

  // Calculate FBO memory
  for (let i = 0; i < fboCount; i++) {
    const size = fboSizes[i] || 1024 * 1024 // Default 1MB per FBO
    totalMemory += size
  }

  // Convert to MB for easier reading
  const memoryMB = totalMemory / (1024 * 1024)

  // Assume 4GB GPU memory as baseline for modern systems (this should be detected)
  const assumedGPUMemory = 4 * 1024 * 1024 * 1024 // 4GB
  const memoryLimit =
    assumedGPUMemory * GPU_SECURITY_CONSTANTS.MAX_GPU_MEMORY_USAGE
  const memoryLimitMB = memoryLimit / (1024 * 1024)

  const isWithinLimits = totalMemory < memoryLimit

  let warning: string | undefined
  if (!isWithinLimits) {
    warning = `GPU memory usage (${memoryMB.toFixed(2)}MB) exceeds recommended limit (${memoryLimitMB.toFixed(2)}MB)`
  } else if (memoryMB > memoryLimitMB * 0.85) {
    warning = `GPU memory usage (${memoryMB.toFixed(2)}MB) is approaching limit (${memoryLimitMB.toFixed(2)}MB)`
  }

  return {
    estimatedUsage: memoryMB,
    isWithinLimits,
    warning,
  }
}

// Sanitize data for worker communication
export function sanitizeWorkerData(data: any): any {
  if (data === null || data === undefined) {
    return data
  }

  if (
    typeof data === "string" ||
    typeof data === "number" ||
    typeof data === "boolean"
  ) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeWorkerData)
  }

  if (typeof data === "object") {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      // Only allow safe property names
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        sanitized[key] = sanitizeWorkerData(value)
      }
    }
    return sanitized
  }

  // Reject functions and other complex types
  throw new Error("Unsafe data type for worker communication")
}

// Test function to debug dimension validation
export function testDimensionValidation(
  width: number,
  height: number
): {
  area: number
  maxArea: number
  maxAllowedArea: number
  areaPercentage: number
  gpuValidation: ReturnType<typeof validateImageDimensions>
  gpuMemory: number
  memoryLimit: number
  estimatedMemoryMB: number
  memoryLimitMB: number
} {
  const area = width * height
  const maxArea =
    GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE *
    GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
  const maxAllowedArea = Math.floor(maxArea * 0.9)
  const areaPercentage = (area / maxAllowedArea) * 100

  const gpuValidation = validateImageDimensions(width, height)

  // Calculate memory values manually
  const bytesPerPixel = 4 // RGBA
  const estimatedMemoryBytes = area * bytesPerPixel

  // Use the same logic as validateImageDimensions
  let gpuMemory: number
  if (gpuValidation.isValid) {
    // If validation passed, use the same fallback logic
    const maxTextureSize = GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    if (maxTextureSize >= 16384) {
      gpuMemory = 8 * 1024 * 1024 * 1024 // 8GB
    } else if (maxTextureSize >= 8192) {
      gpuMemory = 4 * 1024 * 1024 * 1024 // 4GB
    } else if (maxTextureSize >= 4096) {
      gpuMemory = 2 * 1024 * 1024 * 1024 // 2GB
    } else {
      gpuMemory = 1 * 1024 * 1024 * 1024 // 1GB
    }
  } else {
    gpuMemory = 0 // Will be set below
  }

  const memoryLimit = gpuMemory * GPU_SECURITY_CONSTANTS.MAX_GPU_MEMORY_USAGE

  return {
    area,
    maxArea,
    maxAllowedArea,
    areaPercentage,
    gpuValidation,
    gpuMemory,
    memoryLimit,
    estimatedMemoryMB: estimatedMemoryBytes / (1024 * 1024),
    memoryLimitMB: memoryLimit / (1024 * 1024),
  }
}
