import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const sepia: AdjustmentPlugin = {
  id: "sepia",
  name: "Sepia",
  category: "adjustments",
  icon: "Eclipse",
  description: "Adjust the sepia of the image",
  uiSchema: [
    {
      type: "slider",
      key: "sepia",
      sliderType: "grayscale",
      ...sliderDefaults("sepia"),
    },
  ],
  defaults: { sepia: sliderDefaultValue("sepia") ?? 0 },
  toShaderParams: identityToShader,
}
