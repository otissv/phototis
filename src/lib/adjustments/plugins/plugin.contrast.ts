import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

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
      ...sliderDefaults("contrast"),
      sliderType: "grayscale",
    },
  ],
  defaults: { contrast: sliderDefaultValue("contrast") ?? 100 },
  toShaderParams: identityToShader,
}
