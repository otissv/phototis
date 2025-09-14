import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const contrast: AdjustmentPlugin = {
  id: "contrast",
  name: "Contrast",
  uiSchema: [
    {
      kind: "slider",
      key: "contrast",
      label: "Contrast",
      ...sliderDefaults("contrast"),
      sliderType: "grayscale",
    },
  ],
  defaults: { contrast: sliderDefaultValue("contrast") ?? 100 },
  toShaderParams: identityToShader,
}
