import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  sepia: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

export const sepia: AdjustmentPlugin = {
  id: "sepia",
  name: "Sepia",
  category: "adjustments",
  icon: "Eclipse",
  description: "Adjust the sepia of the image",
  uiSchema: [
    {
      type: "slider",
      key: "sepia",
      sliderType: "grayscale",
      ...params.sepia,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
