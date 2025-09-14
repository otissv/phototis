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
      kind: "slider",
      key: "saturation",
      label: "Saturation",
      ...sliderDefaults("saturation"),
    },
  ],
  defaults: { saturation: sliderDefaultValue("saturation") ?? 100 },
  toShaderParams: identityToShader,
}
