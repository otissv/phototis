import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const sepia: AdjustmentPlugin = {
  id: "sepia",
  name: "Sepia",
  uiSchema: [
    {
      kind: "slider",
      key: "sepia",
      label: "Sepia",
      ...sliderDefaults("sepia"),
    },
  ],
  defaults: { sepia: sliderDefaultValue("sepia") ?? 0 },
  toShaderParams: identityToShader,
}
