import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  tint: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

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
      sliderType: "grayscale",
      ...params.tint,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
