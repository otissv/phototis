import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  brightness: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
}

export const brightness: AdjustmentPlugin = {
  id: "brightness",
  name: "Brightness",
  description: "Adjust the brightness of the image",
  category: "adjustments",
  icon: "Sun",
  uiSchema: [
    {
      type: "slider",
      key: "brightness",
      sliderType: "grayscale",
      ...params.brightness,
    },
  ],
  params: params,
  toShaderParams: identityToShader,
}
