import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const temperature: AdjustmentPlugin = {
  id: "temperature",
  name: "Temperature",
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
