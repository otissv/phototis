import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const vintage: AdjustmentPlugin = {
  id: "vintage",
  name: "Vintage",
  uiSchema: [
    {
      kind: "slider",
      key: "vintage",
      label: "Vintage",
      ...sliderDefaults("vintage"),
    },
  ],
  defaults: { vintage: sliderDefaultValue("vintage") ?? 0 },
  toShaderParams: identityToShader,
}
