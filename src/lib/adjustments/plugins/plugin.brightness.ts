import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const brightness: AdjustmentPlugin = {
  id: "brightness",
  name: "Brightness",
  uiSchema: [
    {
      type: "slider",
      key: "brightness",
      ...sliderDefaults("brightness"),
      sliderType: "grayscale",
    },
  ],
  defaults: { brightness: sliderDefaultValue("brightness") ?? 100 },
  toShaderParams: identityToShader,
}
