import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const exposure: AdjustmentPlugin = {
  id: "exposure",
  name: "Exposure",
  category: "adjustments",
  icon: "Sun",
  description: "Adjust the exposure of the image",
  uiSchema: [
    {
      type: "slider",
      key: "exposure",
      ...sliderDefaults("exposure"),
      sliderType: "grayscale",
    },
  ],
  defaults: { exposure: sliderDefaultValue("exposure") ?? 0 },
  toShaderParams: identityToShader,
}
