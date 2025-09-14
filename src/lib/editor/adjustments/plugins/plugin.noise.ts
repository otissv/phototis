import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

export const noise: AdjustmentPlugin = {
  id: "noise",
  name: "Noise",
  uiSchema: [
    {
      kind: "slider",
      key: "noise",
      label: "Noise",
      ...sliderDefaults("noise"),
    },
  ],
  defaults: { noise: sliderDefaultValue("noise") ?? 0 },
  toShaderParams: identityToShader,
}
