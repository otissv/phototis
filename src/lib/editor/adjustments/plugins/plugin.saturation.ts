import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const saturation: AdjustmentPlugin = {
  id: "saturation",
  name: "Saturation",
  uiSchema: [
    {
      type: "slider",
      key: "saturation",
      sliderType: "grayscale",
      ...sliderDefaults("saturation"),
    },
  ],
  defaults: { saturation: sliderDefaultValue("saturation") ?? 100 },
  toShaderParams: identityToShader,
}
