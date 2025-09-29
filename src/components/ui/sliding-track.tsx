"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Dot } from "lucide-react"
import { motion, useMotionValue } from "motion/react"

import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/ui/input"

export interface SlidingTrackProps
  extends Omit<React.ComponentProps<"div">, "onDragEnd" | "onDragStart"> {
  defaultValue?: number
  disabled?: boolean
  max?: number
  min?: number
  operator?: string
  range?: [number, number] | [string, string]
  sensitivity?: number
  step?: number
  value?: number
  isDecimal?: boolean
  label?: (value: string, operator: string) => React.ReactNode
  onDragEnd?: (value: number) => void
  onDragStart?: (value: number) => void
  onValueChange?: (value: number) => void
}

export default function SlidingTrack({
  min = 0,
  max = 100,
  step = 1,
  operator = "",
  value: hostValue = 50,
  defaultValue,
  onValueChange,
  label,
  sensitivity = 0.04,
  disabled = false,
  onDragEnd,
  onDragStart,
  isDecimal = false,
  ...props
}: SlidingTrackProps) {
  const [value, setValue] = React.useState(hostValue)
  const [isEditing, setIsEditing] = React.useState(false)
  const [sliderWidth, setSliderWidth] = React.useState(0)

  // Memoize display value to prevent unnecessary recalculations
  const displayValue = React.useMemo(() => {
    const valueString = isDecimal ? value.toFixed(2) : value
    return (
      label?.(valueString, operator) ||
      `${operator ? `${valueString} ${operator}` : valueString}`
    )
  }, [value, operator, label, isDecimal])

  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const trackWidth = React.useRef(0)
  const prevValueRef = React.useRef(value)
  const initialDragX = React.useRef<number | null>(null)
  const previousX = React.useRef<number | null>(null)
  const lastChangeTime = React.useRef(0)

  const containerId = React.useId()

  // Throttle value changes to prevent excessive updates
  const throttledOnValueChange = React.useCallback(
    (newValue: number) => {
      const now = Date.now()
      if (now - lastChangeTime.current > 16) {
        // ~60fps throttling
        onValueChange?.(newValue)
        lastChangeTime.current = now
      }
    },
    [onValueChange]
  )

  React.useEffect(() => {
    const slider = document.querySelector(
      `[data-id="${containerId}"]`
    ) as HTMLElement
    if (slider) {
      setSliderWidth(slider.offsetWidth)
    }
  }, [containerId])

  React.useEffect(() => {
    const slider = document.querySelector(
      `[data-id="${containerId}"]`
    ) as HTMLElement

    const handleDimensions = () => {
      if (slider) {
        setSliderWidth(slider.offsetWidth)
      }
    }

    window.addEventListener("resize", handleDimensions)
    return () => window.removeEventListener("resize", handleDimensions)
  })

  React.useEffect(() => {
    if (defaultValue !== prevValueRef.current) {
      setValue(defaultValue || 0)
      prevValueRef.current = defaultValue || 0
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

  const handleDrag = React.useCallback(
    (_event: any, info: { point: { x: number } }) => {
      if (disabled) return

      if (initialDragX.current === null) {
        initialDragX.current = info.point.x
        onDragStart?.(value)
        return
      }

      if (previousX.current === info.point.x) {
        return
      }

      const dragDelta = info.point.x - initialDragX.current
      const sensitivityFactor = sensitivity
      const percent =
        (dragDelta * sensitivityFactor) / (trackWidth.current || 1)

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
        throttledOnValueChange(max)
      } else if (newValue < min) {
        setValue(min)
        throttledOnValueChange(min)
      } else {
        setValue(newValue)
        throttledOnValueChange(newValue)
      }
    },
    [
      disabled,
      value,
      min,
      max,
      step,
      sensitivity,
      throttledOnValueChange,
      onDragStart,
    ]
  )

  const handleDragEnd = React.useCallback(() => {
    initialDragX.current = null
    onDragEnd?.(value)
  }, [value, onDragEnd])

  // Memoize dot pattern to prevent recreation on every render
  const dotPattern = React.useMemo(() => [...Array(350)].map((_, i) => i), [])

  const handleDirectionChange = React.useCallback(
    (direction: "left" | "right") => {
      if (direction === "left") {
        let newValue = value - step
        newValue = newValue < min ? min : newValue

        if (newValue === value) return

        setValue(newValue)
        throttledOnValueChange(newValue)
      } else {
        let newValue = value + step
        newValue = newValue > max ? max : newValue

        if (newValue === value) return

        setValue(newValue)
        throttledOnValueChange(newValue)
      }
    },
    [value, step, min, max, throttledOnValueChange]
  )

  const handleOnInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue =
        e.target.value.trim() === "" ? 0 : Number.parseInt(e.target.value)

      setValue(newValue)
      throttledOnValueChange(newValue)
    },
    [throttledOnValueChange]
  )

  return (
    <div
      data-id={containerId}
      className='relative flex flex-col items-center'
      {...props}
    >
      {!isEditing ? (
        <>
          <div className='grid grid-cols-[auto_1fr_auto] justify-center items-center h-10'>
            <Button
              variant='ghost'
              size='icon'
              className='rounded-full transition-opacity duration-200'
              onClick={() => handleDirectionChange("left")}
              disabled={value === min || disabled}
            >
              <ChevronLeft className='size-4' />
            </Button>

            <div
              ref={containerRef}
              className=' h-10 overflow-hidden cursor-grab flex items-center '
            >
              <motion.div
                className='relative w-full h-full flex items-center justify-center'
                style={{ x }}
                drag='x'
                dragConstraints={{
                  left: -trackWidth.current / 2,
                  right: trackWidth.current / 2,
                }}
                dragElastic={0}
                dragMomentum={false}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onDragStart={() => onDragStart?.(value)}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <div className='flex items-center justify-center -translate-x-1/2'>
                  {dotPattern.map((key, i) => {
                    return (
                      <div
                        key={`dot-${key}`}
                        className='text-gray-400 select-none -translate-x-[-452px]'
                      >
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
              className='rounded-full transition-opacity duration-200'
              onClick={() => handleDirectionChange("right")}
              disabled={value === max || disabled}
            >
              <ChevronRight className='size-4' />
            </Button>
          </div>

          <div className='text-xs flex flex-col items-center -translate-y-10'>
            <div
              onPointerDown={() => {
                setIsEditing(true)
                setTimeout(() => {
                  inputRef.current?.focus()
                }, 0)
              }}
            >
              <div className='w-full flex flex-col justify-center items-center'>
                {displayValue}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className='relative flex flex-col items-center gap-2 mt-1'>
          <div className='flex items-center gap-2'>
            <Input
              ref={inputRef}
              value={Math.round(value)}
              onChange={handleOnInputChange}
              onBlur={() => setIsEditing(false)}
              className={cn("bg-transparent p-1 text-center rounded-full")}
              disabled={disabled}
            />
          </div>

          <p className='text-xs text-muted-foreground'>
            {min}
            {operator} &ndash; {max}
            {operator}
          </p>
        </div>
      )}
    </div>
  )
}
