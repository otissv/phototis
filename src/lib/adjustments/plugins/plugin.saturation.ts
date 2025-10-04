import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const saturation: AdjustmentPlugin = {
  id: "saturation",
  name: "Saturation",
  category: "adjustments",
  icon: "Droplets",
  description: "Adjust the saturation of the image",
  uiSchema: [
    {
      type: "slider",
      key: "saturation",
      sliderType: "grayscale",
      ...sliderDefaults("saturation"),
    },
  ],
  defaults: { saturation: sliderDefaultValue("saturation") ?? 100 },
  toShaderParams: identityToShader,
}
