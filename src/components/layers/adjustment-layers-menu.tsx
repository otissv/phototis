"use client"

import { useMemo } from "react"

import { Button } from "@/ui/button"
import { DropdownMenu } from "@radix-ui/react-dropdown-menu"
import { DropdownMenuContent, DropdownMenuTrigger } from "@/ui/dropdown-menu"
import { PLUGINS } from "@/lib/adjustments/plugins"
import { Eclipse } from "lucide-react"

export interface AdjustmentLayersMenuProps {
  disabled?: boolean
  handleAddAdjustmentLayer: (adjustmentType: string) => void
}
export function AdjustmentLayersMenu({
  disabled = false,
  handleAddAdjustmentLayer,
}: AdjustmentLayersMenuProps) {
  const layersItems = useMemo(() => {
    return PLUGINS.filter((plugin) => plugin.category === "adjustments").sort(
      (a, b) => a.name.localeCompare(b.name)
    )
  }, [])

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
          {layersItems.map((plugin) => {
            let Icon = null

            if (plugin.icon) {
              const lucide = require("lucide-react")
              Icon = lucide[plugin.icon as keyof typeof lucide]
            }

            return (
              <Button
                key={plugin.id}
                variant='ghost'
                size='sm'
                className='text-xs h-8 justify-start rounded-sm'
                onClick={() => handleAddAdjustmentLayer(plugin.id)}
              >
                {Icon && <Icon className='w-3 h-3 mr-1' />}
                {plugin.name}
              </Button>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
