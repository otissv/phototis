import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const colorize: AdjustmentPlugin = {
  id: "colorize",
  name: "Colorize",
  uiSchema: [
    { kind: "slider", key: "colorizeHue", label: "Hue" },
    {
      kind: "slider",
      key: "colorizeSaturation",
      label: "Colorize Saturation",
    },
    {
      kind: "slider",
      key: "colorizeLightness",
      label: "Colorize Lightness",
    },
    { kind: "slider", key: "colorizeAmount", label: "Amount" },
    {
      kind: "toggle",
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
