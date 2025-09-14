import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const invert: AdjustmentPlugin = {
  id: "invert",
  name: "Invert",
  uiSchema: [{ kind: "toggle", key: "invert", label: "Invert" }],
  defaults: { invert: (TOOL_VALUES.invert as any)?.defaultValue ?? 0 },
  toShaderParams: (params) => {
    const value = Number((params as any).invert || 0)
    return { invert: value }
  },
}
