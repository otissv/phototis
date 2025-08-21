import { type VariantProps, cva } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const inputVariants = (variants: any, defaultVariants: any) =>
  cva(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    {
      variants: {
        variant: {
          default: "",
          destructive:
            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          secondary:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost:
            "border-transparent hover:bg-accent hover:text-accent-foreground",
          ...variants?.variant,
        },
        size: {
          default: "h-10 px-4 py-2",
          sm: "h-9 rounded-md px-3",
          lg: "h-11 rounded-md px-8",
          icon: "h-10 w-10",
          ...variants?.size,
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
        ...defaultVariants,
      },
    }
  )

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  asChild?: boolean
  variants?: {
    variant: Record<string, string>
    size: Record<string, string>
  }
  defaultVariants?: { variant: string; size: string }
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, variant, size, variants, defaultVariants, ...props },
    ref
  ) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants(variants, defaultVariants)({ variant, size, className })
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
