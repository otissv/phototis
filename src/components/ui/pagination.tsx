import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "../ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role='navigation'
    aria-label='pagination'
    className={cn("mx-auto flex w-full", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("flex flex-row gap-2", className)} {...props} />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("list-none flex items-center text-sm", className)}
    {...props}
  />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & ButtonProps

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <Button
    variant={isActive ? "active" : "outline"}
    variants={{
      variant: {
        active:
          "background-accent-foreground bg-gray-900 text-accent-foreground font-medium border hover:bg-accent hover:text-accent-foreground",
      },
    }}
    aria-current={isActive ? "page" : undefined}
    className={cn("h-10 w-10 p-0 font-medium", className)}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationFirstPage = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label='Go to first page'
    size='default'
    className={className}
    {...props}
  >
    <ChevronFirst className='h-4 w-4' />
    <span className='sr-only'>First page</span>
  </PaginationLink>
)

const PaginationLastPage = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label='Go to Last page'
    size='default'
    className={className}
    {...props}
  >
    <ChevronLast className='h-4 w-4' />
    <span className='sr-only'>First page</span>
  </PaginationLink>
)

const PaginationPrevious = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label='Go to previous page'
    size='default'
    className={className}
    {...props}
  >
    <ChevronLeft className='h-4 w-4' />
    <span className='sr-only'>Previous page</span>
    {children}
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label='Go to next page'
    size='default'
    className={className}
    {...props}
  >
    {children}
    <ChevronRight className='h-4 w-4' />
    <span className='sr-only'>Next page</span>
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span aria-hidden className={cn("self-end p-2", className)} {...props}>
    <MoreHorizontal className='h-4 w-4' />
    <span className='sr-only'>More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationFirstPage,
  PaginationLastPage,
}
