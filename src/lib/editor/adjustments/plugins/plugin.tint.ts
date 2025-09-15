import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const tintPlugin: AdjustmentPlugin = {
  id: "tint",
  name: "Tint",
  description: "Add warm (positive) or cool (negative) tint",
  category: "color",
  icon: "🎨",
  capabilities: ["Designer", "Motion", "Pro"],
  uiSchema: [
    {
      kind: "slider",
      key: "tint",
      label: "Tint",
      ...sliderDefaults("tint"),
      sliderType: "grayscale",
    },
  ],
  defaults: { tint: sliderDefaultValue("tint") ?? 0 },
  toShaderParams: identityToShader,
}
