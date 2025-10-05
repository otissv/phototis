import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  contrast: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
}

export const contrast: AdjustmentPlugin = {
  id: "contrast",
  name: "Contrast",
  category: "adjustments",
  icon: "Sun",
  description: "Adjust the contrast of the image",
  uiSchema: [
    {
      type: "slider",
      key: "contrast",
      sliderType: "grayscale",
      ...params.contrast,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
