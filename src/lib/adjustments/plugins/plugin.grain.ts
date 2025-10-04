import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const grain: AdjustmentPlugin = {
  id: "grain",
  name: "Grain",
  description: "Add film grain noise to the image",
  category: "effects",
  icon: "Eclipse",
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
