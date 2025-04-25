import { ChevronDown } from "lucide-react"
import { Button } from "../ui/button"
import { SelectContent, SelectItem } from "../ui/select"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectTrigger, SelectValue } from "../ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet"
import { Slider } from "../ui/slider"
import { cn } from "@/lib/utils"

function findClosestQuality(value: number) {
  if (value <= 10) return "10"
  if (value <= 35) return "35"
  if (value <= 60) return "60"
  if (value <= 80) return "80"
  if (value <= 99) return "90"
  return "100"
}

export interface QualityOptionsProps
  extends React.ComponentProps<typeof Sheet> {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  quality: number
  setQuality: (quality: number) => void
  onClick: () => void
  description: string
  title: string
  children: React.ReactNode
}

export function QualityOptions({
  isOpen,
  setIsOpen,
  quality,
  setQuality,
  onClick,
  description,
  title,
  children,
  ...props
}: QualityOptionsProps) {
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} {...props}>
      <SheetTrigger asChild>
        <Button
          variant='outline'
          onClick={() => setIsOpen(true)}
          className={cn(
            "relative flex cursor-default select-none justify-start items-center rounded-sm border-0 w-full px-2 py-1.5 h-auto text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          )}
        >
          {children}&hellip;
        </Button>
      </SheetTrigger>
      <SheetContent
        description='Quality options'
        className='w-full flex flex-col gap-10 '
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className='text-foreground'>
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className='flex justify-center mt-6'>
          {/* TODO: show preview image */}
          <form className='space-y-4 max-w-[600px]'>
            <div className='flex items-center gap-2'>
              <Label htmlFor='jpeg-quality' className='text-right'>
                Quality:
              </Label>

              <Input
                type='number'
                value={quality}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setQuality(Number(e.target.value))
                }
                name='jpeg-quality'
                className='w-20'
              />

              <Select
                value={findClosestQuality(quality)}
                onValueChange={(value) => setQuality(Number(value))}
                name='jpeg-quality'
              >
                <SelectTrigger className='w-[110px]'>
                  <SelectValue placeholder='Select a fruit' />
                  <ChevronDown className='w-4 h-4 ml-2' />
                </SelectTrigger>
                <SelectContent className='w-[110px]'>
                  <SelectItem value='100'>None</SelectItem>
                  <SelectItem value='90'>Very Low</SelectItem>
                  <SelectItem value='80'>Low</SelectItem>
                  <SelectItem value='60'>Medium</SelectItem>
                  <SelectItem value='35'>High</SelectItem>
                  <SelectItem value='10'>Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Slider
              name='jpeg-quality'
              value={[quality]}
              onValueChange={([value]) => setQuality(value)}
              min={0}
              max={100}
              step={1}
            />
          </form>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button
              variant='outline'
              className='rounded-full'
              onClick={() => {
                setIsOpen(false)
              }}
            >
              Cancel
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              type='submit'
              onClick={() => {
                onClick?.()
                setIsOpen(false)
              }}
              className='rounded-full'
            >
              Download
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
