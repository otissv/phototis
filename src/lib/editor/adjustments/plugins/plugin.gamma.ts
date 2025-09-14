import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const gamma: AdjustmentPlugin = {
  id: "gamma",
  name: "Gamma",
  uiSchema: [
    {
      kind: "slider",
      key: "gamma",
      label: "Gamma",
      ...sliderDefaults("gamma"),
      sliderType: "grayscale",
    },
  ],
  defaults: { gamma: sliderDefaultValue("gamma") ?? 1 },
  toShaderParams: identityToShader,
}
