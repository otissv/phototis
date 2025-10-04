import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const vintage: AdjustmentPlugin = {
  id: "vintage",
  name: "Vintage",
  category: "adjustments",
  icon: "Eclipse",
  description: "Adjust the vintage of the image",
  uiSchema: [
    {
      type: "slider",
      key: "vintage",
      ...sliderDefaults("vintage"),
    },
  ],
  defaults: { vintage: sliderDefaultValue("vintage") ?? 0 },
  toShaderParams: identityToShader,
}
