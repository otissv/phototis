import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const noise: AdjustmentPlugin = {
  id: "noise",
  name: "Noise",
  description: "Add film grain noise to the image",
  category: "texture",
  icon: "🎭",
  capabilities: ["Designer", "Motion", "Pro"],
  uiSchema: [
    {
      kind: "slider",
      key: "noiseAmount",
      label: "Amount",
      ...sliderDefaults("noiseAmount"),
      sliderType: "grayscale",
    },
    {
      kind: "slider",
      key: "noiseSize",
      label: "Size",
      ...sliderDefaults("noiseSize"),
      sliderType: "grayscale",
    },
  ],
  defaults: {
    noiseAmount: sliderDefaultValue("noiseAmount") ?? 0,
    noiseSize: sliderDefaultValue("noiseSize") ?? 1.0,
  },
  toShaderParams: identityToShader,
}
