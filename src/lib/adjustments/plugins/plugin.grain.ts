import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  grain: {
    min: 0.1,
    max: 5.0,
    step: 0.1,
    defaultValue: 1.0,
  },
}

export const grain: AdjustmentPlugin = {
  id: "grain",
  name: "Grain",
  description: "Add film grain noise to the image",
  category: "effects",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "grain",
      ...params.grain,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
