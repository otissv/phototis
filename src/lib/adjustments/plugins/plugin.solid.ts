import type { AdjustmentPlugin } from "../registry"
import { hexToRgba01 } from "../helpers"
import type { ShaderDescriptor } from "@/lib/shaders/types.shader"

const params = {
  solid: {
    defaultValue: "#000000",
  },
}

const solidShaderDescriptor: ShaderDescriptor = {
  name: "adjustments.solid",
  version: "1.0.0",
  sources: {
    vertex: `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main(){ v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }
`,
    fragment: `#version 300 es
precision highp float;
uniform float u_opacity;
uniform int u_solidEnabled;
uniform vec3 u_solidColor;
uniform float u_solidAlpha;
in vec2 v_texCoord;
out vec4 outColor;

void main(){
  vec4 color;
  // Solid overlay renders a single color
  if (u_solidEnabled == 1) {
    color = vec4(u_solidColor, clamp(u_solidAlpha, 0.0, 1.0));
  } else {
    color = vec4(0.0, 0.0, 0.0, 0.0);
  }
  color.a *= u_opacity / 100.0;
  outColor = color;
}
`,
  },
  policies: { hybrid: "warm", worker: "warm" },
}

export const solid: AdjustmentPlugin = {
  id: "solid",
  name: "Solid",
  uiSchema: [{ type: "color", key: "solid" }],
  category: "adjustments",
  icon: "Palette",
  description: "Adjust the solid of the image",
  params,
  shaderDescriptor: solidShaderDescriptor,
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
