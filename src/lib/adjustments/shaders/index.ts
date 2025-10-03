// Basic color adjustments
import { BrightnessShaderDescriptor } from "@/lib/adjustments/shaders/brightness.shader-descriptor"
import { ContrastShaderDescriptor } from "@/lib/adjustments/shaders/contrast.shader-descriptor"
import { SaturationShaderDescriptor } from "@/lib/adjustments/shaders/saturation.shader-descriptor"
import { HueShaderDescriptor } from "@/lib/adjustments/shaders/hue.shader-descriptor"
import { ExposureShaderDescriptor } from "@/lib/adjustments/shaders/exposure.shader-descriptor"
import { GammaShaderDescriptor } from "@/lib/adjustments/shaders/gamma.shader-descriptor"

// Filters and effects
import { GrayscaleShaderDescriptor } from "@/lib/adjustments/shaders/grayscale.shader-descriptor"
import { InvertShaderDescriptor } from "@/lib/adjustments/shaders/invert.shader-descriptor"
import { SepiaShaderDescriptor } from "@/lib/adjustments/shaders/sepia.shader-descriptor"
import { VibranceShaderDescriptor } from "@/lib/adjustments/shaders/vibrance.shader-descriptor"

// Color effects
import { ColorizeShaderDescriptor } from "@/lib/adjustments/shaders/colorize.shader-descriptor"
import { TemperatureShaderDescriptor } from "@/lib/adjustments/shaders/temperature.shader-descriptor"
import { TintShaderDescriptor } from "@/lib/adjustments/shaders/tint.shader-descriptor"

// Detail effects
import { SharpenShaderDescriptor } from "@/lib/adjustments/shaders/sharpen.shader-descriptor"
import { NoiseShaderDescriptor } from "@/lib/adjustments/shaders/noise.shader-descriptor"

// Multi-pass effects
import { GaussianBlurShaderDescriptor } from "@/lib/adjustments/shaders/gaussian-blur.shader-descriptor"

// Special effects
import { solidShaderDescriptor } from "@/lib/adjustments/shaders/solid.shader-descriptor"

// Collect all shader descriptors for easy registration
export const AdjustmentShaderDescriptors = [
  BrightnessShaderDescriptor,
  ContrastShaderDescriptor,
  SaturationShaderDescriptor,
  HueShaderDescriptor,
  ExposureShaderDescriptor,
  GammaShaderDescriptor,
  GrayscaleShaderDescriptor,
  InvertShaderDescriptor,
  SepiaShaderDescriptor,
  VibranceShaderDescriptor,
  ColorizeShaderDescriptor,
  TemperatureShaderDescriptor,
  TintShaderDescriptor,
  SharpenShaderDescriptor,
  NoiseShaderDescriptor,
  GaussianBlurShaderDescriptor,
  solidShaderDescriptor,
] as const
