import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const grayscale: AdjustmentPlugin = {
  id: "grayscale",
  name: "Grayscale",
  description: "Convert the image to grayscale",
  category: "adjustments",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "grayscale",
      ...sliderDefaults("grayscale"),
      sliderType: "grayscale",
    },
  ],
  defaults: { grayscale: sliderDefaultValue("grayscale") ?? 0 },
  toShaderParams: identityToShader,
}
