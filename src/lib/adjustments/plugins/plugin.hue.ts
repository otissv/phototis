import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  hue: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 180,
  },
}

export const hue: AdjustmentPlugin = {
  id: "hue",
  name: "Hue",
  category: "adjustments",
  icon: "Droplets",
  description: "Adjust the hue of the image",
  uiSchema: [
    {
      type: "slider",
      key: "hue",
      ...params.hue,
      sliderType: "hue",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
