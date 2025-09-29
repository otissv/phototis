"use client"

import * as React from "react"
import { Palette } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import { toTitle } from "@/lib/utils/toTitle"
import { Input } from "@/ui/input"

type Color = {
  color: string
  name: string
}

export function Color({
  color,
  colors,
  disabled,
  icon,
  isTable = false,
  side = "bottom",
  sideOffset = 0,
  title = "color",
  onSelect,
  onCustomColorChange,
  isPopover = true,
}: {
  color: string
  colors: Color[]
  disabled: boolean
  icon?: React.ReactNode
  isTable?: boolean
  isPopover?: boolean
  property?: string
  side?: "bottom" | "left" | "right" | "top"
  sideOffset?: number
  title?: string
  onCustomColorChange: (
    [key, value]: [string, string],
    customColors: Record<string, string>
  ) => void
  onSelect?: (value: string) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  return isPopover ? (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {!isTable ? (
          <Button
            title={`Open ${title} dropdown`}
            variant={"transparent"}
            className='size-8 p-2 border-none hover:bg-muted hover:text-muted-foreground rounded-sm'
            size='Toolbar'
            onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) =>
              e.preventDefault()
            }
            onClick={() => setIsOpen(!isOpen)}
          >
            {icon || <Palette />}
          </Button>
        ) : (
          <div
            onMouseDown={(e: React.MouseEvent<HTMLDivElement>) =>
              e.preventDefault()
            }
            className='cursor-pointer'
            title={title}
          >
            {title}
          </div>
        )}
      </PopoverTrigger>
      <PopoverContent
        className='w-full p-2 rounded-md'
        side={side}
        sideOffset={sideOffset}
      >
        <ColorContent
          colors={colors}
          color={color}
          className='w-full grid grid-cols-10 grid-rows-8 gap-1.5'
          onSelect={onSelect}
          onCustomColorChange={onCustomColorChange}
        />
      </PopoverContent>
    </Popover>
  ) : (
    <ColorContent
      colors={colors}
      color={color}
      className='w-full grid grid-cols-10 grid-rows-8 gap-1.5'
      onSelect={onSelect}
      onCustomColorChange={onCustomColorChange}
    />
  )
}

const initialCustomColors = {
  color1: "#ffffff",
  color2: "#FFFFFF",
  color3: "#FFFFFF",
  color4: "#FFFFFF",
  color5: "#FFFFFF",
  color6: "#FFFFFF",
  color7: "#FFFFFF",
  color8: "#FFFFFF",
  color9: "#FFFFFF",
  color10: "#FFFFFF",
  color11: "#FFFFFF",
  color12: "#FFFFFF",
  color13: "#FFFFFF",
  color14: "#FFFFFF",
  color15: "#FFFFFF",
  color16: "#FFFFFF",
  color17: "#FFFFFF",
  color18: "#FFFFFF",
  color19: "#FFFFFF",
  color20: "#FFFFFF",
}

export interface ColorContentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  colors: Color[]
  onCustomColorChange: (
    [key, value]: [string, string],
    customColors: Record<string, string>
  ) => void
  onSelect?: (value: string) => void
}
export function ColorContent({
  className,
  colors,
  color,
  onSelect,
  onCustomColorChange,
  ...props
}: ColorContentProps) {
  const [customColors, setCustomColors] =
    React.useState<Record<string, string>>(initialCustomColors)

  const handleOnCustomColorChange =
    (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomColors({ ...customColors, [name]: e.target.value })
      onSelect?.(e.target.value)
      onCustomColorChange?.([name, e.target.value], customColors)
    }

  const handleOnSelect = (value: string) => {
    onSelect?.(value)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleOnCustomColorChange cause infinite rerender loop
  const customColorList = React.useMemo(() => {
    return Object.entries(customColors).map(([name, color]) => {
      return (
        <Input
          key={name}
          title='Add a custom color'
          type='color'
          className={cn(
            "p-0 bg-transparent focus:bg-accent size-6 rounded-none"
          )}
          aria-describedby='add custom color'
          value={color}
          onChange={handleOnCustomColorChange(name)}
        />
      )
    })
  }, [customColors])

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-col border-b gap-2 mt-2'>
        <span className='text-sm font-medium text-muted-foreground'>
          Custom Colors
        </span>
        <div className='w-full grid grid-cols-10 grid-rows-2 gap-1.5 p-2'>
          {customColorList}
        </div>
      </div>
      <div
        className={cn(
          "w-full grid grid-cols-10 grid-rows-8 gap-1.5 p-2",
          className
        )}
        {...props}
      >
        {colors.map(({ name, color: colorValue }) => {
          return (
            <Button
              key={colorValue}
              title={toTitle(name)}
              type='button'
              onClick={() => handleOnSelect(colorValue)}
              className={cn(
                "size-6 p-0 border",
                colorValue === color && "ring-2 ring-offset-2"
              )}
              style={{ background: colorValue }}
              onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) =>
                e.preventDefault()
              }
            />
          )
        })}
      </div>
    </div>
  )
}
