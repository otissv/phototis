"use client"

import { ChevronDown } from "lucide-react"

import { Button } from "@/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/ui/collapsible"
import { cn } from "@/lib/utils"
import React from "react"

export interface LayerItemProps
  extends React.ComponentProps<typeof Collapsible> {
  triggerClassName?: string
  contentClassName?: string
}
export function LayerItem({
  children,
  title,
  triggerClassName,
  contentClassName,
  ...props
}: LayerItemProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} {...props}>
      <CollapsibleTrigger asChild>
        <Button
          title={title}
          variant='ghost'
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-10 w-full p-0 rounded-sm justify-between px-2 border bg-accent",
            "hover:bg-accent/80",
            triggerClassName
          )}
        >
          {title}
          <ChevronDown className='h-4 w-4' />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent
        className={cn(
          "flex flex-col border-b border-l border-r rounded-b-sm p-2",
          contentClassName
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
