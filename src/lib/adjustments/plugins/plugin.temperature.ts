import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const temperature: AdjustmentPlugin = {
  id: "temperature",
  name: "Temperature",
  category: "adjustments",
  icon: "Palette",
  description: "Adjust the temperature of the image",
  uiSchema: [
    {
      type: "slider",
      key: "temperature",
      ...sliderDefaults("temperature"),
      sliderType: "grayscale",
    },
  ],
  defaults: { temperature: sliderDefaultValue("temperature") ?? 0 },
  toShaderParams: identityToShader,
}
