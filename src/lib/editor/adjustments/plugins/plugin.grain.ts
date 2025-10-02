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
      type: "slider",
      key: "grain",
      ...sliderDefaults("grain"),
    },
  ],
  defaults: { grain: sliderDefaultValue("grain") ?? 0 },
  toShaderParams: identityToShader,
}
