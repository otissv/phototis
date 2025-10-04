import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

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
      ...sliderDefaults("gaussianAmount"),
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "gaussianRadius",
      label: "Radius",
      ...sliderDefaults("gaussianRadius"),
      sliderType: "grayscale",
    },
  ],
  defaults: {
    gaussianAmount: sliderDefaultValue("gaussianAmount") ?? 0,
    gaussianRadius: sliderDefaultValue("gaussianRadius") ?? 1.0,
  },
  toShaderParams: identityToShader,
}
