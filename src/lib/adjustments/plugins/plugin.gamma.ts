import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const gamma: AdjustmentPlugin = {
  id: "gamma",
  name: "Gamma",
  category: "adjustments",
  icon: "Sun",
  description: "Adjust the gamma of the image",
  uiSchema: [
    {
      type: "slider",
      key: "gamma",
      ...sliderDefaults("gamma"),
      sliderType: "grayscale",
    },
  ],
  defaults: { gamma: sliderDefaultValue("gamma") ?? 1 },
  toShaderParams: identityToShader,
}
