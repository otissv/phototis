import type { AdjustmentPlugin } from "../registry"
import { identityToShader, sliderDefaults } from "../helpers"
import { TOOL_VALUES } from "@/lib/tools/tools"

export const blur: AdjustmentPlugin = {
  id: "blur",
  name: "Blur",
  uiSchema: [
    { kind: "slider", key: "blur", label: "Blur", ...sliderDefaults("blur") },
    {
      kind: "slider",
      key: "blurType",
      label: "Blur Type",
      ...sliderDefaults("blurType"),
    },
    {
      kind: "slider",
      key: "blurDirection",
      label: "Direction",
      ...sliderDefaults("blurDirection"),
    },
    {
      kind: "slider",
      key: "blurCenter",
      label: "Center",
      ...sliderDefaults("blurCenter"),
    },
  ],
  defaults: {
    blur: (TOOL_VALUES.blur as any)?.defaultValue ?? 0,
    blurType: (TOOL_VALUES.blurType as any)?.defaultValue ?? 0,
    blurDirection: (TOOL_VALUES.blurDirection as any)?.defaultValue ?? 0,
    blurCenter: (TOOL_VALUES.blurCenter as any)?.defaultValue ?? 0.5,
  },
  toShaderParams: identityToShader,
}
