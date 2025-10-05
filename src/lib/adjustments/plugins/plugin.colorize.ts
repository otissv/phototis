import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"

const params = {
  colorizeHue: {
    min: 0,
    max: 360,
    step: 1,
    defaultValue: 180,
  },
  colorizeSaturation: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
  },
  colorizeLightness: {
    min: -100,
    max: 200,
    step: 1,
    defaultValue: 50,
  },
  colorizeAmount: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
  },
  colorizePreserveLum: {
    defaultValue: false,
  },
}

export const colorize: AdjustmentPlugin = {
  id: "colorize",
  name: "Colorize",
  description: "Colorize the image",
  category: "adjustments",
  icon: "Palette",
  uiSchema: [
    { type: "slider", key: "colorizeHue", label: "Hue", sliderType: "hue" },
    {
      type: "slider",
      key: "colorizeSaturation",
      label: "Saturation",
      sliderType: "grayscale",
      ...params.colorizeSaturation,
    },
    {
      type: "slider",
      key: "colorizeLightness",
      label: "Lightness",
      sliderType: "grayscale",
      ...params.colorizeLightness,
    },
    {
      type: "slider",
      key: "colorizeAmount",
      label: "Amount",
      sliderType: "grayscale",
      ...params.colorizeAmount,
    },
    {
      type: "toggle",
      key: "colorizePreserveLum",
      label: "Preserve Lum",
      ...params.colorizePreserveLum,
    },
  ],
  params,
  toShaderParams: identityToShader,
}
