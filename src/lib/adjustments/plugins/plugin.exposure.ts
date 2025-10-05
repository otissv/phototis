import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  exposure: {
    min: -100,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}
export const exposure: AdjustmentPlugin = {
  id: "exposure",
  name: "Exposure",
  category: "adjustments",
  icon: "Sun",
  description: "Adjust the exposure of the image",
  uiSchema: [
    {
      type: "slider",
      key: "exposure",
      sliderType: "grayscale",
      ...params.exposure,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
