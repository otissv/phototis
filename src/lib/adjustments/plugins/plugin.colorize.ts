import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const colorize: AdjustmentPlugin = {
  id: "colorize",
  name: "Colorize",
  description: "Colorize the image",
  category: "adjustments",
  icon: "Palette",
  uiSchema: [
    { type: "slider", key: "colorizeHue", label: "Hue", sliderType: "hue" },
    {
      type: "slider",
      key: "colorizeSaturation",
      label: "Saturation",
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "colorizeLightness",
      label: "Lightness",
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "colorizeAmount",
      label: "Amount",
      sliderType: "grayscale",
    },
    {
      type: "toggle",
      key: "colorizePreserveLum",
      label: "Preserve Lum",
    },
  ],
  defaults: {
    colorizeHue: (TOOL_VALUES.colorizeHue as any)?.defaultValue ?? 0,
    colorizeSaturation:
      (TOOL_VALUES.colorizeSaturation as any)?.defaultValue ?? 0,
    colorizeLightness:
      (TOOL_VALUES.colorizeLightness as any)?.defaultValue ?? 0,
    colorizeAmount: (TOOL_VALUES.colorizeAmount as any)?.defaultValue ?? 0,
    preserveLum:
      (TOOL_VALUES.colorizePreserveLum as any)?.defaultValue ?? false,
  },
  toShaderParams: identityToShader,
}
