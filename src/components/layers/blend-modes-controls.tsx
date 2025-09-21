"use client"

import { ChevronDown } from "lucide-react"

import { useCurrentLayer } from "@/lib/hooks/useCurrentLayer"
import { BlendMode } from "@/lib/shaders/blend-modes/types.blend"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { BLEND_MODE_NAMES } from "@/lib/shaders/blend-modes/blend-modes"

export interface BlendModesControlsProps extends React.ComponentProps<"div"> {
  isDragActive: boolean
  isGlobalDragActive: boolean
  isDocumentLayerSelected: boolean

  selectedLayerId: string | null
  handleBlendModeChange: (layerId: string, blendMode: BlendMode) => void
}

export function BlendModesControls({
  isDragActive,
  isGlobalDragActive = false,
  isDocumentLayerSelected,
  selectedLayerId,
  handleBlendModeChange,
  className,
  ...props
}: BlendModesControlsProps) {
  const currentLayer = useCurrentLayer({
    selectedLayerId,
    isDocumentLayerSelected,
  })

  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      <div className='text-xs'>Blend:</div>
      {/* Blend Mode Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-xs'
            disabled={isDragActive || isGlobalDragActive || !selectedLayerId}
          >
            <span className='whitespace-nowrap'>
              {currentLayer?.blendMode
                ? BLEND_MODE_NAMES[currentLayer.blendMode]
                : "Normal"}
            </span>
            <ChevronDown className='w-3 h-3 ml-1' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='bg-background p-2 border rounded-sm flex flex-col'>
          {Object.entries(BLEND_MODE_NAMES).map(([mode, name]) => (
            <Button
              key={mode}
              variant='ghost'
              size='sm'
              className='text-xs h-8 justify-start whitespace-nowrap'
              onClick={() =>
                selectedLayerId &&
                handleBlendModeChange(selectedLayerId, mode as BlendMode)
              }
            >
              {name}
            </Button>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
