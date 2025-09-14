import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const grayscale: AdjustmentPlugin = {
  id: "grayscale",
  name: "Grayscale",
  uiSchema: [
    {
      kind: "slider",
      key: "grayscale",
      label: "Grayscale",
      ...sliderDefaults("grayscale"),
      sliderType: "grayscale",
    },
  ],
  defaults: { grayscale: sliderDefaultValue("grayscale") ?? 0 },
  toShaderParams: identityToShader,
}
