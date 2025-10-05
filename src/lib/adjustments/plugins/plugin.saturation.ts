import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  saturation: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
}

export const saturation: AdjustmentPlugin = {
  id: "saturation",
  name: "Saturation",
  category: "adjustments",
  icon: "Droplets",
  description: "Adjust the saturation of the image",
  uiSchema: [
    {
      type: "slider",
      key: "saturation",
      sliderType: "grayscale",
      ...params.saturation,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
