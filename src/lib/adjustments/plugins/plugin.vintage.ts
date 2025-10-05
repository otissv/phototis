import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  vintage: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
}

export const vintage: AdjustmentPlugin = {
  id: "vintage",
  name: "Vintage",
  category: "adjustments",
  icon: "Eclipse",
  description: "Adjust the vintage of the image",
  uiSchema: [
    {
      type: "slider",
      key: "vintage",
      ...params.vintage,
      sliderType: "grayscale",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
