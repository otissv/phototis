import type { AdjustmentPlugin } from "../registry"
import {
  identityToShader,
  sliderDefaultValue,
  sliderDefaults,
} from "../helpers"

const params = {
  sharpenAmount: {
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 0,
  },
  sharpenRadius: {
    min: 0.1,
    max: 10,
    step: 0.1,
    defaultValue: 1.5,
  },
  sharpenThreshold: {
    min: 0,
    max: 255,
    step: 1,
    defaultValue: 0,
  },
}

export const sharpen: AdjustmentPlugin = {
  id: "sharpen",
  name: "Sharpen",
  description: "Unsharp mask sharpening",
  category: "effects",
  icon: "Eclipse",
  uiSchema: [
    {
      type: "slider",
      key: "sharpenAmount",
      label: "Amount",
      ...params.sharpenAmount,
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "sharpenRadius",
      label: "Radius",
      ...params.sharpenRadius,
      sliderType: "grayscale",
    },
    {
      type: "slider",
      key: "sharpenThreshold",
      label: "Threshold",
      ...params.sharpenThreshold,
      sliderType: "grayscale",
    },
  ],
  params,
  toShaderParams: identityToShader,
}
