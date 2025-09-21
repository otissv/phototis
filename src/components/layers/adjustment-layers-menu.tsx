"use client"

import { Droplets, Eclipse, Palette, Sparkles, Sun } from "lucide-react"

import { Button } from "@/ui/button"
import { DropdownMenu } from "@radix-ui/react-dropdown-menu"
import { DropdownMenuContent, DropdownMenuTrigger } from "@/ui/dropdown-menu"

export interface AdjustmentLayersMenuProps {
  disabled?: boolean
  handleAddAdjustmentLayer: (adjustmentType: string) => void
}
export function AdjustmentLayersMenu({
  disabled = false,
  handleAddAdjustmentLayer,
}: AdjustmentLayersMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          title='Add adjustment layer'
          variant='ghost'
          size='sm'
          className='h-8 w-8 p-0 rounded-sm'
          disabled={disabled}
        >
          <Eclipse className='w-4 h-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='bg-background p-2 border rounded-sm'>
        <div className='grid grid-cols-2 gap-1'>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("brightness")}
          >
            <Sun className='w-3 h-3 mr-1' />
            Brightness
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("contrast")}
          >
            <Palette className='w-3 h-3 mr-1' />
            Contrast
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("exposure")}
          >
            <Sun className='w-3 h-3 mr-1' />
            Exposure
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("gamma")}
          >
            <Palette className='w-3 h-3 mr-1' />
            Gamma
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("hue")}
          >
            <Droplets className='w-3 h-3 mr-1' />
            Hue
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("saturation")}
          >
            <Droplets className='w-3 h-3 mr-1' />
            Saturation
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("temperature")}
          >
            <Droplets className='w-3 h-3 mr-1' />
            Temperature
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("vibrance")}
          >
            <Sparkles className='w-3 h-3 mr-1' />
            Vibrance
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("grayscale")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Grayscale
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("sepia")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Sepia
          </Button>

          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("solid")}
          >
            <Palette className='w-3 h-3 mr-1' />
            Solid Color
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("colorize")}
          >
            <Palette className='w-3 h-3 mr-1' />
            Colorize
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("invert")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Invert
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-xs h-8 justify-start rounded-sm'
            onClick={() => handleAddAdjustmentLayer("tint")}
          >
            <Eclipse className='w-3 h-3 mr-1' />
            Tint
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
