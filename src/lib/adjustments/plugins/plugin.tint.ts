import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const tintPlugin: AdjustmentPlugin = {
  id: "tint",
  name: "Tint",
  category: "adjustments",
  icon: "Palette",
  description: "Add warm (positive) or cool (negative) tint",
  capabilities: ["Designer", "Motion", "Pro"],
  uiSchema: [
    {
      type: "slider",
      key: "tint",
      ...sliderDefaults("tint"),
      sliderType: "grayscale",
    },
  ],
  defaults: { tint: sliderDefaultValue("tint") ?? 0 },
  toShaderParams: identityToShader,
}
