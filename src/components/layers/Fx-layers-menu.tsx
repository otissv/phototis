"use client"

import { Eclipse } from "lucide-react"

import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { FxIcon } from "@/ui/icons/fx-icon"

export interface FxLayersMenuProps {
  handleAddAdjustmentLayer: (fxType: string) => void
}
export function FxLayersMenu({ handleAddAdjustmentLayer }: FxLayersMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          title='Add FX layer'
          variant='ghost'
          size='sm'
          className='h-8 w-8 p-0 rounded-sm'
        >
          {" "}
          <FxIcon className='w-4 h-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='bg-background p-2 border rounded-sm'>
        <div className='grid grid-cols-2 gap-1'>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("sharpen")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Sharpen
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("noise")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Noise
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("gaussian")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Gaussian Blur
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
