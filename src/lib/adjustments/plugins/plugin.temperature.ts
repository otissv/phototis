import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  temperature: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

export const temperature: AdjustmentPlugin = {
  id: "temperature",
  name: "Temperature",
  category: "adjustments",
  icon: "Palette",
  description: "Adjust the temperature of the image",
  uiSchema: [
    {
      type: "slider",
      key: "temperature",
      ...params.temperature,
      sliderType: "grayscale",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
