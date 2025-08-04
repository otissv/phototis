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
  className,
  ...props
}: ImageEditorButtonProps) {
  return (
    <Button
      size='sm'
      className={cn(
        "text-xs rounded-sm",
        {
          "bg-primary text-primary-foreground": isActive,
        },
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
ImageEditorButton.displayName = "ImageEditorButton"
