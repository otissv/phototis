import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  gamma: {
    min: 0.1,
    max: 3.0,
    step: 0.01,
    defaultValue: 1,
  },
}

export const gamma: AdjustmentPlugin = {
  id: "gamma",
  name: "Gamma",
  category: "adjustments",
  icon: "Sun",
  description: "Adjust the gamma of the image",
  uiSchema: [
    {
      type: "slider",
      key: "gamma",
      ...params.gamma,
      sliderType: "grayscale",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
