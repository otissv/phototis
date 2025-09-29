"use client"

import * as SwitchPrimitives from "@radix-ui/react-switch"
import * as React from "react"

import { cn } from "@/lib/utils"

export type ToggleSwitchOnOffTypes =
  | "on,off"
  | "enable,disable"
  | "start,stop"
  | "subscribe,unsubscribe"
  | "accept,decline"
  | "active,inactive"
  | "allow,block"
  | "approve,reject"
  | "opt in,opt out"
  | "true,false"
  | "yes,no"
  | string

export type ToggleSwitchProps = React.ForwardRefExoticComponent<
  SwitchPrimitives.SwitchProps &
    Omit<React.RefAttributes<HTMLButtonElement>, "title"> & {
      onOff?: ToggleSwitchOnOffTypes
      title: string
      className?: string
      classNameThumb?: string
      classNameOn?: string
      classNameOff?: string
    }
>
const ToggleSwitch = React.forwardRef<
  React.ElementRef<ToggleSwitchProps>,
  React.ComponentPropsWithoutRef<ToggleSwitchProps>
>(
  (
    {
      onOff = "true,false",
      className,
      checked,
      classNameThumb,
      classNameOn,
      classNameOff,
      ...props
    },
    ref
  ) => {
    let on: string
    let off: string

    if (onOff === "on,off") {
      on = "On"
      off = "Off"
    } else if (onOff === "enable,disable") {
      on = "Enable"
      off = "Disable"
    } else if (onOff === "start,stop") {
      on = "Start"
      off = "Stop"
    } else if (onOff === "subscribe,unsubscribe") {
      on = "Subscribe"
      off = "Unsubscribe"
    } else if (onOff === "accept,decline") {
      on = "Accept"
      off = "Decline"
    } else if (onOff === "active,inactive") {
      on = "Active"
      off = "Inactive"
    } else if (onOff === "allow,block") {
      on = "Allow"
      off = "Block"
    } else if (onOff === "approve,reject") {
      on = "Approve"
      off = "Reject"
    } else if (onOff === "opt in,opt out") {
      on = "Opt In"
      off = "Opt Out"
    } else if (onOff === "true,false") {
      on = "True"
      off = "False"
    } else if (onOff === "yes,no") {
      on = "yes"
      off = "No"
    } else {
      const [_on, _off] = onOff.split(",")
      on = _on
      off = _off
    }

    return (
      <SwitchPrimitives.Root
        className={cn(
          "relative peer flex h-10 cursor-pointer items-center rounded-md border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=unchecked]:bg-input",
          className
        )}
        {...props}
        checked={checked}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "absolute pointer-events-none block h-9 w-[50%] bg-background rounded-md shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-0 data-[state=unchecked]:translate-x-[100%]",
            classNameThumb
          )}
        />
        <div className='relative grid gap-2 grid-cols-2 p-2 justify-center items-center w-full'>
          <div
            className={cn(
              "flex justify-center px-1 text-foreground",

              classNameOn
            )}
            data-state={checked ? "checked" : "unchecked"}
          >
            {on}
          </div>
          <div
            className={cn("flex justify-center px-1", classNameOff)}
            data-state={checked ? "checked" : "unchecked"}
          >
            {off}
          </div>
        </div>
      </SwitchPrimitives.Root>
    )
  }
)
ToggleSwitch.displayName = SwitchPrimitives.Root.displayName

export { ToggleSwitch }
