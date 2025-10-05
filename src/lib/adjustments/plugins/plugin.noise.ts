import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  noiseAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  noiseSize: {
    min: 0.1,
    max: 5.0,
    step: 0.1,
    defaultValue: 1.0,
  },
}

export const noise: AdjustmentPlugin = {
  id: "noise",
  name: "Noise",
  description: "Add film grain noise to the image",
  icon: "Eclipse",
  category: "effects",
  uiSchema: [
    {
      type: "slider",
      key: "noiseAmount",
      label: "Amount",
      ...params.noiseAmount,
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "noiseSize",
      label: "Size",
      ...params.noiseSize,
      sliderType: "grayscale",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
