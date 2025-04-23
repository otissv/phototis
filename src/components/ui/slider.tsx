"use client"

import * as SliderPrimitive from "@radix-ui/react-slider"
import * as React from "react"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ComponentProps<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    label?: React.ReactNode
    onPointerDown?: (event: React.PointerEvent) => void
    onPointerUp?: (event: React.PointerEvent) => void
    onPointerMove?: (event: React.PointerEvent) => void
  }
>(({ className, children, ...props }, ref) => {
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className='relative h-2 w-full grow overflow-hidden rounded-full bg-secondary'>
        <SliderPrimitive.Range className='absolute h-full bg-primary' />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className='block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'>
        {children}
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
