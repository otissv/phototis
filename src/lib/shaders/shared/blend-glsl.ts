// Re-export compiled GLSL for blend modes from existing implementation for parity
// Importing string constant or constructing from existing module ensures single source of truth
import { BLEND_MODE_GLSL as BASE } from "@/lib/shaders/blend-modes/blend-modes"

export const BLEND_MODE_GLSL = BASE
