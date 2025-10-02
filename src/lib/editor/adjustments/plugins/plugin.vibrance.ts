import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const vibrance: AdjustmentPlugin = {
  id: "vibrance",
  name: "Vibrance",
  uiSchema: [
    {
      type: "slider",
      key: "vibrance",
      sliderType: "grayscale",
      ...sliderDefaults("vibrance"),
    },
  ],
  defaults: { vibrance: sliderDefaultValue("vibrance") ?? 0 },
  toShaderParams: identityToShader,
}
