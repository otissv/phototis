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
      kind: "slider",
      key: "vibrance",
      label: "Vibrance",
      ...sliderDefaults("vibrance"),
    },
  ],
  defaults: { vibrance: sliderDefaultValue("vibrance") ?? 0 },
  toShaderParams: identityToShader,
}
