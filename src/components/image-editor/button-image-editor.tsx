"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ImageEditorButtonProps
  extends React.ComponentProps<typeof Button> {
  isActive?: boolean
}

export function ImageEditorButton({
  children,
  isActive,
  ...props
}: ImageEditorButtonProps) {
  return (
    <Button
      size='sm'
      className={cn("text-xs rounded-full", {
        "bg-primary text-primary-foreground": isActive,
      })}
      {...props}
    >
      {children}
    </Button>
  )
}
