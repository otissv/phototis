import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const sharpen: AdjustmentPlugin = {
  id: "sharpen",
  name: "Sharpen",
  description: "Unsharp mask sharpening",
  category: "detail",
  icon: "✨",
  capabilities: ["Designer", "Motion", "Pro"],
  uiSchema: [
    {
      kind: "slider",
      key: "sharpenAmount",
      label: "Amount",
      ...sliderDefaults("sharpenAmount"),
      sliderType: "grayscale",
    },
    {
      kind: "slider",
      key: "sharpenRadius",
      label: "Radius",
      ...sliderDefaults("sharpenRadius"),
      sliderType: "grayscale",
    },
    {
      kind: "slider",
      key: "sharpenThreshold",
      label: "Threshold",
      ...sliderDefaults("sharpenThreshold"),
      sliderType: "grayscale",
    },
  ],
  defaults: {
    sharpenAmount: sliderDefaultValue("sharpenAmount") ?? 0,
    sharpenRadius: sliderDefaultValue("sharpenRadius") ?? 1.5,
    sharpenThreshold: sliderDefaultValue("sharpenThreshold") ?? 0,
  },
  toShaderParams: identityToShader,
}
