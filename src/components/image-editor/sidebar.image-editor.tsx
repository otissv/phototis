"use client"

import {
  Blend,
  Funnel,
  ImageUpscale,
  RotateCwSquare,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SIDEBAR_TOOLS, type TOOL_VALUES } from "@/constants"
import type { ImageEditorToolsActions } from "@/components/image-editor/state.image-editor"

export interface ImageEditorSidebarProps
  extends Omit<React.ComponentProps<"ul">, "onChange"> {
  selected: keyof typeof SIDEBAR_TOOLS
  onChange: (selected: keyof typeof SIDEBAR_TOOLS) => void
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  dispatch: React.Dispatch<ImageEditorToolsActions>
  progress?: number
}
export function ImageEditorSidebar({
  selected,
  className,
  onChange,
  onSelectedToolChange,
  dispatch,
  progress,
  ...props
}: ImageEditorSidebarProps) {
  return (
    <ul className={cn("flex flex-col gap-2", className)} {...props}>
      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "adjust",
          })}
          onClick={() => {
            onChange("adjust")

            if (!SIDEBAR_TOOLS.adjust.includes(selected)) {
              onSelectedToolChange("brightness")
            }
          }}
          disabled={progress}
        >
          <SlidersHorizontal />
          Adjust
        </Button>
      </li>
      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "rotate",
          })}
          onClick={() => {
            onChange("rotate")

            if (!SIDEBAR_TOOLS.rotate.includes(selected)) {
              onSelectedToolChange("rotate")
            }
          }}
          disabled={progress}
        >
          <RotateCwSquare />
          Rotate
        </Button>
      </li>

      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "scale",
          })}
          onClick={() => {
            onChange("scale")

            if (!SIDEBAR_TOOLS.scale.includes(selected)) {
              onSelectedToolChange("scale")
            }
          }}
          disabled={progress}
        >
          <ImageUpscale />
          scale
        </Button>
      </li>

      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "effects",
          })}
          onClick={() => {
            onChange("effects")

            if (!SIDEBAR_TOOLS.effects.includes(selected)) {
              onSelectedToolChange("blur")
            }
          }}
          disabled={progress}
        >
          <Funnel />
          Filters
        </Button>
      </li>
      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "presets",
          })}
          onClick={() => {
            onChange("presets")

            if (!SIDEBAR_TOOLS.effects.includes(selected)) {
              onSelectedToolChange("blur")
            }
          }}
          disabled={progress}
        >
          <Sparkles />
          Presets
        </Button>
      </li>
    </ul>
  )
}
