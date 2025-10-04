import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const vibrance: AdjustmentPlugin = {
  id: "vibrance",
  name: "Vibrance",
  category: "adjustments",
  icon: "Sparkles",
  description: "Adjust the vibrance of the image",
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
