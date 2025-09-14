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
      kind: "slider",
      key: "brightness",
      label: "Brightness",
      ...sliderDefaults("brightness"),
      sliderType: "grayscale",
    },
  ],
  defaults: { brightness: sliderDefaultValue("brightness") ?? 100 },
  toShaderParams: identityToShader,
}
