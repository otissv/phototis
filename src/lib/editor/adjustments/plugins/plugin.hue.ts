import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const hue: AdjustmentPlugin = {
  id: "hue",
  name: "Hue",
  uiSchema: [
    {
      type: "slider",
      key: "hue",
      ...sliderDefaults("hue"),
      sliderType: "hue",
    },
  ],
  defaults: { hue: sliderDefaultValue("hue") ?? 180 },
  toShaderParams: identityToShader,
}
