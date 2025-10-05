import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  grayscale: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 100,
  },
}

export const grayscale: AdjustmentPlugin = {
  id: "grayscale",
  name: "Grayscale",
  description: "Convert the image to grayscale",
  category: "adjustments",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "grayscale",
      ...params.grayscale,
      sliderType: "grayscale",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
