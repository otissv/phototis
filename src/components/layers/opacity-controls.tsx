"use client"

import React from "react"
import { ChevronDown } from "lucide-react"

import { useCurrentLayer } from "@/lib/hooks/useCurrentLayer"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { Input } from "@/ui/input"

export interface OpacityControlsProps extends React.ComponentProps<"div"> {
  isDragActive: boolean
  isGlobalDragActive: boolean
  isDocumentLayerSelected: boolean
  selectedLayerId: string | null
  handleOpacityChange: (layerId: string, opacity: number) => void
}

export function OpacityControls({
  isDragActive,
  isGlobalDragActive = false,
  isDocumentLayerSelected,
  selectedLayerId,
  handleOpacityChange,
}: OpacityControlsProps) {
  const currentLayer = useCurrentLayer({
    selectedLayerId,
    isDocumentLayerSelected,
  })

  return (
    <div className='flex items-center gap-2'>
      <span className='text-xs'>Opacity:</span>
      <div className='flex items-center border rounded-sm h-9'>
        <Input
          type='number'
          min='0'
          max='100'
          value={currentLayer?.opacity ?? 100}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            selectedLayerId &&
            handleOpacityChange(
              selectedLayerId as string,
              Number(e.target.value)
            )
          }
          className=' px-2 py-1 h-8 border-none'
          disabled={isDragActive || isGlobalDragActive || !selectedLayerId}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='size-8 p-0 rounded-sm'
              disabled={isDragActive || isGlobalDragActive || !selectedLayerId}
            >
              <ChevronDown className='w-3 h-3' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <div className='z-10 flex items-center gap-2 border rounded-sm h-10 bg-background p-2'>
              <input
                type='range'
                min='0'
                max='100'
                value={currentLayer?.opacity || 0}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  selectedLayerId &&
                  handleOpacityChange(
                    selectedLayerId as string,
                    Number(e.target.value)
                  )
                }
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
                className='h-1 bg-secondary rounded-lg appearance-none cursor-pointer'
                disabled={
                  isDragActive || isGlobalDragActive || !selectedLayerId
                }
              />
              <span className='text-xs w-8'>{currentLayer?.opacity || 0}%</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
