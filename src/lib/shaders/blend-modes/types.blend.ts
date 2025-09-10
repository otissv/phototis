export type BlendMode =
  // Normal
  | "normal"
  | "dissolve"
  // Darken
  | "darken"
  | "multiply"
  | "color-burn"
  | "linear-burn"
  | "darker-color"
  // Lighten
  | "lighten"
  | "screen"
  | "color-dodge"
  | "linear-dodge"
  | "lighter-color"
  // Contrast
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "vivid-light"
  | "linear-light"
  | "pin-light"
  | "hard-mix"
  // Comparative
  | "difference"
  | "exclusion"
  | "subtract"
  | "divide"
  // Component
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"

export type BlendModePlugin = {
  id: BlendMode
  name: string
  glslFunctionName: string
  glsl: string
}
