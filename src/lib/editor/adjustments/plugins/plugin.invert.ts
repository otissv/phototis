import type { AdjustmentPlugin } from "../registry"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const invert: AdjustmentPlugin = {
  id: "invert",
  name: "Invert",
  uiSchema: [{ type: "toggle", key: "invert" }],
  defaults: { invert: (TOOL_VALUES.invert as any)?.defaultValue ?? 0 },
  toShaderParams: (params) => {
    const value = Number((params as any).invert || 0)
    return { invert: value }
  },
}
