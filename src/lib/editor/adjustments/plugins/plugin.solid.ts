import type { AdjustmentPlugin } from "../registry"
import { identityToShader, hexToRgba01 } from "../helpers"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const solid: AdjustmentPlugin = {
  id: "solid",
  name: "Solid",
  uiSchema: [{ kind: "color", key: "solid", label: "Solid Color" }],
  defaults: { solid: (TOOL_VALUES.solid as any)?.defaultValue ?? "#000000" },
  toShaderParams: (params) => {
    const out: Record<string, unknown> = {}
    const solid = params.solid as any
    console.log("Solid plugin toShaderParams called with:", { params, solid })
    if (typeof solid === "string") {
      const rgba = hexToRgba01(solid.trim()) || [0, 0, 0, 1]
      out.u_solidEnabled = 1
      out.u_solidColor = [rgba[0], rgba[1], rgba[2]]
      out.u_solidAlpha = rgba[3]
      console.log("Solid string case:", { solid, rgba, out })
    } else if (
      solid &&
      typeof solid === "object" &&
      typeof solid.color === "string"
    ) {
      const rgba = hexToRgba01(solid.color.trim()) || [0, 0, 0, 1]
      const value = typeof solid.value === "number" ? solid.value : 100
      out.u_solidEnabled = value > 0 ? 1 : 0
      out.u_solidColor = [rgba[0], rgba[1], rgba[2]]
      out.u_solidAlpha = rgba[3]
      console.log("Solid object case:", { solid, rgba, value, out })
    } else {
      out.u_solidEnabled = 0
      console.log("Solid fallback case:", { solid, out })
    }
    return out
  },
}
