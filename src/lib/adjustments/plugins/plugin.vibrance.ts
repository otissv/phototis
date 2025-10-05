import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  vibrance: {
    min: 0,
    max: 200,
    step: 1,
    defaultValue: 100,
  },
}

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
      ...params.vibrance,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
