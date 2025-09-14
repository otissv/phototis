import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const grain: AdjustmentPlugin = {
  id: "grain",
  name: "Grain",
  uiSchema: [
    {
      kind: "slider",
      key: "grain",
      label: "Grain",
      ...sliderDefaults("grain"),
    },
  ],
  defaults: { grain: sliderDefaultValue("grain") ?? 0 },
  toShaderParams: identityToShader,
}
