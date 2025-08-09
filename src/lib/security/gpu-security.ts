// GPU Security utilities for validating operations and preventing memory issues
// Implements security measures for WebGL operations in workers

// Security constants
export const GPU_SECURITY_CONSTANTS = {
  // Maximum texture dimensions
  MAX_TEXTURE_SIZE: 16384,
  MAX_CANVAS_DIMENSION: 8192,

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

  // Memory limits
  MAX_GPU_MEMORY_USAGE: 0.8, // 80% of available GPU memory
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
  maxVertexOutputVectors: number
  maxFragmentInputVectors: number
  minAliasedLineWidth: number
  maxAliasedLineWidth: number
  minAliasedPointSize: number
  maxAliasedPointSize: number
  maxViewportWidth: number
  maxViewportHeight: number
  maxDrawBuffers: number
  maxColorAttachments: number
  maxSamples: number
}

// Detect GPU capabilities
export function detectGPUCapabilities(
  gl: WebGL2RenderingContext
): GPUCapabilities {
  return {
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
    maxVertexOutputVectors: gl.getParameter(gl.MAX_VERTEX_OUTPUT_VECTORS),
    maxFragmentInputVectors: gl.getParameter(gl.MAX_FRAGMENT_INPUT_VECTORS),
    minAliasedLineWidth: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[0],
    maxAliasedLineWidth: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)[1],
    minAliasedPointSize: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[0],
    maxAliasedPointSize: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
    maxViewportWidth: gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0],
    maxViewportHeight: gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1],
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
    maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
  }
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

  if (
    width * height >
    GPU_SECURITY_CONSTANTS.MAX_CANVAS_DIMENSION *
      GPU_SECURITY_CONSTANTS.MAX_CANVAS_DIMENSION
  ) {
    return {
      isValid: false,
      error: "Image area exceeds maximum allowed size",
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

  if (validatedParameters.tint !== undefined) {
    const clampedTint = Math.max(
      -GPU_SECURITY_CONSTANTS.MAX_TINT,
      Math.min(validatedParameters.tint, GPU_SECURITY_CONSTANTS.MAX_TINT)
    )
    if (clampedTint !== validatedParameters.tint) {
      errors.push(
        `Tint value clamped from ${validatedParameters.tint} to ${clampedTint}`
      )
    }
    validatedParameters.tint = clampedTint
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
      0.1,
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

  // Assume 2GB GPU memory as baseline (this should be detected)
  const assumedGPUMemory = 2 * 1024 * 1024 * 1024 // 2GB
  const memoryLimit =
    assumedGPUMemory * GPU_SECURITY_CONSTANTS.MAX_GPU_MEMORY_USAGE
  const memoryLimitMB = memoryLimit / (1024 * 1024)

  const isWithinLimits = totalMemory < memoryLimit

  let warning: string | undefined
  if (!isWithinLimits) {
    warning = `GPU memory usage (${memoryMB.toFixed(2)}MB) exceeds recommended limit (${memoryLimitMB.toFixed(2)}MB)`
  } else if (memoryMB > memoryLimitMB * 0.8) {
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
