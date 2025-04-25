"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet"
import { useState } from "react"

export default function Playground() {
  const [isOpen, setIsOpen] = useState(false)

  console.log(isOpen)

  return (
    <div className='p-4'>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            className='bg-primary text-primary-foreground'
            onClick={() => setIsOpen(true)}
          >
            Open Sheet
          </Button>
        </SheetTrigger>
        <SheetContent
          description='Test sheet'
          className='fixed top-0 right-0 h-screen w-[400px] border border-border bg-background shadow-lg data-[state=open]:animate-slide-in-from-right data-[state=closed]:animate-slide-out-to-right'
        >
          <SheetHeader>
            <SheetTitle>Test Sheet</SheetTitle>
            <SheetDescription>Test sheet</SheetDescription>
          </SheetHeader>
          <div className='p-4'>
            <p>This is a test sheet content.</p>
            <button
              type='button'
              onClick={() => setIsOpen(false)}
              className='mt-4 px-4 py-2 bg-primary text-primary-foreground rounded'
            >
              Close
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
