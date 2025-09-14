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
      kind: "slider",
      key: "hue",
      label: "Hue",
      ...sliderDefaults("hue"),
      sliderType: "hue",
    },
  ],
  defaults: { hue: sliderDefaultValue("hue") ?? 180 },
  toShaderParams: identityToShader,
}
