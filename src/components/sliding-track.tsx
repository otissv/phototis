"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ChevronUp, Dot } from "lucide-react"
import { motion, useMotionValue, transform } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"
import { Input } from "./ui/input"

const SLIDER_WIDTH = 500 // pixels

interface SlidingTrackProps {
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  operator?: string
  sensitivity?: number
  onValueChange?: (value: number) => void
  range?: [number, number] | [string, string]
  label?: (value: number, operator: string) => React.ReactNode
}

export default function SlidingTrack({
  min = 0,
  max = 100,
  step = 1,
  operator = "",
  defaultValue = 50,
  onValueChange,
  label,
  sensitivity = 0.04,
}: SlidingTrackProps) {
  const [value, setValue] = useState(defaultValue)
  const [isEditing, setIsEditing] = useState(false)
  const displayValue =
    label?.(value, operator) || `${operator ? `${value} ${operator}` : value}`
  const inputRef = useRef<HTMLInputElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const trackWidth = useRef(0)
  const prevValueRef = useRef(value)
  const initialDragX = useRef<number | null>(null)
  const previousX = useRef<number | null>(null)
  const [sliderWidth, setSliderWidth] = useState(0)

  const containerId = useId()

  useEffect(() => {
    const slider = document.querySelector(
      `[data-id="${containerId}"]`
    ) as HTMLElement
    if (slider) {
      setSliderWidth(slider.offsetWidth)
    }
  }, [containerId])

  useEffect(() => {
    const slider = document.querySelector(
      `[data-id="${containerId}"]`
    ) as HTMLElement

    const handleResize = () => {
      if (slider) {
        console.log(slider.offsetWidth)
        setSliderWidth(slider.offsetWidth)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  })

  useEffect(() => {
    if (defaultValue !== prevValueRef.current) {
      setValue(defaultValue)
      prevValueRef.current = defaultValue
    }

    if (containerRef.current) {
      const newTrackWidth = containerRef.current.offsetWidth
      if (newTrackWidth !== trackWidth.current) {
        trackWidth.current = newTrackWidth
      }

      const percentOffset =
        ((value - min) / (max - min) - 0.5) * trackWidth.current
      x.set(percentOffset)
    }
  }, [defaultValue, value, min, max, x])

  const handleDrag = (_event: any, info: { point: { x: number } }) => {
    if (initialDragX.current === null) {
      initialDragX.current = info.point.x
      return
    }

    if (previousX.current === info.point.x) {
      return
    }

    const dragDelta = info.point.x - initialDragX.current
    const sensitivityFactor = sensitivity
    const percent = (dragDelta * sensitivityFactor) / (trackWidth.current || 1)

    // Calculate the new value based on the previous value and drag delta
    const previousValuePercent = (value - min) / (max - min)
    const newValuePercent = Math.max(
      0,
      Math.min(1, previousValuePercent - percent)
    )
    const rawValue = newValuePercent * (max - min) + min

    const newValue =
      Math.round(Math.min(Math.max(rawValue, min), max) / step) * step

    previousX.current = info.point.x

    if (newValue === value) return

    if (newValue > max) {
      setValue(max)
      onValueChange?.(max)
    } else if (newValue < min) {
      setValue(min)
      onValueChange?.(min)
    } else {
      setValue(newValue)
      onValueChange?.(newValue)
    }
  }

  const handleDragEnd = () => {
    initialDragX.current = null
  }

  const dotPattern = [...Array(350)]

  const handleDirectionChange = (direction: "left" | "right") => {
    if (direction === "left") {
      let newValue = value - step
      newValue = newValue < min ? min : newValue

      if (newValue === value) return

      setValue(newValue)
      onValueChange?.(newValue)
    } else {
      let newValue = value + step
      newValue = newValue > max ? max : newValue

      if (newValue === value) return

      setValue(newValue)
      onValueChange?.(newValue)
    }
  }

  const handleOnInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue =
      e.target.value.trim() === "" ? 0 : Number.parseInt(e.target.value)

    setValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <div data-id={containerId} className='relative'>
      <div className='grid grid-cols-[auto_1fr_auto] justify-center items-center'>
        <Button
          variant='ghost'
          size='icon'
          className='rounded-full disabled:opacity-0 transition-opacity duration-200'
          onClick={() => handleDirectionChange("left")}
          disabled={value === min}
        >
          <ChevronLeft className='size-4' />
        </Button>

        <div ref={containerRef} className=' h-2 overflow-hidden cursor-grab'>
          <motion.div
            drag='x'
            dragConstraints={{
              left: -sliderWidth / 2,
              right: sliderWidth / 2,
            }}
            style={{ x }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className='flex h-2'
          >
            <div className='flex items-center justify-center -translate-x-1/2'>
              {dotPattern.map((_, i) => {
                return (
                  <div key={`dot-${i}`} className='text-gray-400 select-none'>
                    <Dot
                      className={cn("w-2 h-2 ", {
                        "w-4 h-4": i % 2 === 0,
                      })}
                    />
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        <Button
          variant='ghost'
          size='icon'
          className='rounded-full disabled:opacity-0 transition-opacity duration-200'
          onClick={() => handleDirectionChange("right")}
          disabled={value === max}
        >
          <ChevronRight className='size-4' />
        </Button>
      </div>

      <div className='text-xs flex flex-col items-center -translate-y-4'>
        <div
          onPointerDown={() => {
            setIsEditing(true)
            setTimeout(() => {
              inputRef.current?.focus()
            }, 0)
          }}
        >
          {isEditing ? (
            <div className='flex flex-col items-center gap-2 mt-1'>
              <Input
                ref={inputRef}
                value={value}
                onChange={handleOnInputChange}
                onBlur={() => setIsEditing(false)}
                className='bg-transparent border-none p-1 text-center h-6'
              />
              <p className='text-xs text-muted-foreground'>
                {min}
                {operator} to {max}
                {operator}
              </p>
            </div>
          ) : (
            <div className='w-full flex flex-col justify-center items-center'>
              <ChevronUp className='size-3' />
              {displayValue}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
