import type { AdjustmentPlugin } from "../registry"
import { identityToShader } from "../helpers"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const colorize: AdjustmentPlugin = {
  id: "colorize",
  name: "Colorize",
  uiSchema: [{ kind: "color+slider", key: "colorize", label: "Colorize" }],
  defaults: {
    colorize: (TOOL_VALUES.colorize as any)?.defaultValue ?? {
      value: 0,
      color: "#000000",
    },
  },
  toShaderParams: identityToShader,
}
