"use client"

import { Blend, ImageUpscale, SlidersHorizontal, History } from "lucide-react"

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
}
export function ImageEditorSidebar({
  selected,
  className,
  onChange,
  onSelectedToolChange,
  dispatch,
  ...props
}: ImageEditorSidebarProps) {
  return (
    <ul className={cn("flex flex-col gap-2", className)} {...props}>
      <li>
        <Button
          title='Reset'
          variant='ghost'
          className='flex rounded-md text-xs p-0'
          onClick={() => {
            dispatch({ type: "reset" })
          }}
        >
          <History className='size-4' />
          Reset
        </Button>
      </li>
      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "transform",
          })}
          onClick={() => {
            onChange("transform")

            if (!SIDEBAR_TOOLS.transform.includes(selected)) {
              onSelectedToolChange("rotate")
            }
          }}
        >
          <ImageUpscale />
          Transform
        </Button>
      </li>

      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "finetune",
          })}
          onClick={() => {
            onChange("finetune")

            if (!SIDEBAR_TOOLS.finetune.includes(selected)) {
              onSelectedToolChange("brightness")
            }
          }}
        >
          <SlidersHorizontal />
          Finetune
        </Button>
      </li>

      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "filter",
          })}
          onClick={() => {
            onChange("filter")

            if (!SIDEBAR_TOOLS.filter.includes(selected)) {
              onSelectedToolChange("tint")
            }
          }}
        >
          <Blend />
          Filter
        </Button>
      </li>
      <li>
        <Button
          variant='outline'
          className={cn("flex flex-col rounded-md text-xs size-18", {
            "bg-accent text-accent-foreground": selected === "upscale",
          })}
          onClick={() => {
            onChange("upscale")

            if (!SIDEBAR_TOOLS.filter.includes(selected)) {
              onSelectedToolChange("upscale")
            }
          }}
        >
          <ImageUpscale />
          Upscale
        </Button>
      </li>
    </ul>
  )
}
