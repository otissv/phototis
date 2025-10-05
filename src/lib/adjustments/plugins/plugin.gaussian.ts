import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  gaussianAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
  },
  gaussianRadius: {
    min: 0.1,
    max: 10,
    step: 0.1,
    defaultValue: 1.0,
  },
}

export const gaussian: AdjustmentPlugin = {
  id: "gaussian",
  name: "Gaussian Blur",
  description: "Apply Gaussian blur to the image",
  category: "effects",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "gaussianAmount",
      label: "Amount",
      sliderType: "grayscale",
      ...params.gaussianAmount,
    },
    {
      type: "slider",
      key: "gaussianRadius",
      label: "Radius",
      sliderType: "grayscale",
      ...params.gaussianRadius,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
