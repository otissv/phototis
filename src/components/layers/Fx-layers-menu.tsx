"use client"

import { useMemo } from "react"

import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { FxIcon } from "@/ui/icons/fx-icon"
import { PLUGINS } from "@/lib/adjustments/plugins"

export interface FxLayersMenuProps {
  handleAddAdjustmentLayer: (fxType: string) => void
}
export function FxLayersMenu({ handleAddAdjustmentLayer }: FxLayersMenuProps) {
  const layersItems = useMemo(() => {
    return PLUGINS.filter((plugin) => plugin.category === "effects").sort(
      (a, b) => a.name.localeCompare(b.name)
    )
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          title='Add FX layer'
          variant='ghost'
          size='sm'
          className='h-8 w-8 p-0 rounded-sm'
        >
          <FxIcon className='w-4 h-4' />
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
