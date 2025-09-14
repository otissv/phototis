import type { AdjustmentPlugin } from "../registry"
import { brightness } from "./plugin.brightness"
import { contrast } from "./plugin.contrast"
import { exposure } from "./plugin.exposure"
import { gamma } from "./plugin.gamma"
import { hue } from "./plugin.hue"
import { saturation } from "./plugin.saturation"
import { temperature } from "./plugin.temperature"
import { vibrance } from "./plugin.vibrance"
import { vintage } from "./plugin.vintage"
import { grayscale } from "./plugin.grayscale"
import { invert } from "./plugin.invert"
import { sepia } from "./plugin.sepia"
import { blur } from "./plugin.blur"
import { noise } from "./plugin.noise"
import { grain } from "./plugin.grain"
import { colorize } from "./plugin.colorize"
import { solid } from "./plugin.solid"

export const PLUGINS: readonly AdjustmentPlugin[] = [
  brightness,
  contrast,
  exposure,
  gamma,
  hue,
  saturation,
  temperature,
  vibrance,
  vintage,
  grayscale,
  invert,
  sepia,
  blur,
  noise,
  grain,
  colorize,
  solid,
]
