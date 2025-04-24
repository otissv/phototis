"use client"

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className='flex items-center justify-center'>
        <Circle className='h-2.5 w-2.5 fill-current text-current' />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

interface RadioGroupContentProps extends React.ComponentPropsWithoutRef<"ul"> {}
function RadioGroupContent({
  className,
  children,
  ...props
}: RadioGroupContentProps) {
  return (
    <ul className={cn("flex justify-center gap-6", className)} {...props}>
      {children}
    </ul>
  )
}
RadioGroupContent.displayName = "RadioGroupContent"

interface RadioGroupContentItemProps
  extends React.ComponentPropsWithoutRef<"li"> {
  value: string
}
function RadioGroupContentItem({
  className,
  children,
  value,
  ...props
}: RadioGroupContentItemProps) {
  return (
    <li className='flex items-center gap-1' {...props}>
      <RadioGroupItem value={value} id={value} />
      <label htmlFor={value}>{children}</label>
    </li>
  )
}
RadioGroupContentItem.displayName = "RadioGroupContentItem"

export { RadioGroup, RadioGroupContent, RadioGroupItem, RadioGroupContentItem }
