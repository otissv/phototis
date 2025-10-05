import type { AdjustmentPlugin } from "../registry"

const params = {
  invert: {
    defaultValue: 0,
  },
}

export const invert: AdjustmentPlugin = {
  id: "invert",
  name: "Invert",
  category: "adjustments",
  icon: "Eclipse",
  description: "Invert the colors of the image",
  uiSchema: [{ type: "toggle", key: "invert" }],
  params,
  toShaderParams: (params) => {
    const value = Number((params as any).invert || 0)
    return { invert: value }
  },
}
