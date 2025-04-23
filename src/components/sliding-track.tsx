"use client"

import { cn } from "@/lib/utils"
import { ChevronUp, Dot, Minus } from "lucide-react"
import { motion, useMotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"

const SLIDER_WIDTH = 500 // pixels

interface SlidingTrackProps {
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  operator?: string
  onValueChange?: (value: number) => void
}

export default function SlidingTrack({
  min = 0,
  max = 100,
  step = 1,
  operator = "",
  defaultValue = 50,
  onValueChange,
}: SlidingTrackProps) {
  const [value, setValue] = useState(defaultValue)
  const containerRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const trackWidth = useRef(0)
  const prevValueRef = useRef(value)

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

  const handleDrag = (event: any, info: { point: { x: number } }) => {
    const deltaX =
      info.point.x - (containerRef.current?.getBoundingClientRect().left ?? 0)
    const percent = deltaX / (trackWidth.current || 1)
    const rawValue = (1 - percent) * (max - min) + min
    const newValue =
      Math.round(Math.min(Math.max(rawValue, min), max) / step) * step

    if (newValue !== value) {
      setValue(newValue)
      onValueChange?.(newValue)
    }
  }

  const dotCount = 100 //Math.floor((max - min) / 2) + 1

  return (
    <div className='w-full flex justify-center items-center'>
      <div className='relative flex flex-col items-center'>
        <div
          ref={containerRef}
          className='relative flex items-center h-2 overflow-hidden cursor-grab'
          style={{ width: `${SLIDER_WIDTH + 20}px` }}
        >
          <motion.div
            drag='x'
            dragConstraints={{
              left: -SLIDER_WIDTH / 2,
              right: SLIDER_WIDTH / 2,
            }}
            style={{ x }}
            onDrag={handleDrag}
            className='absolute inset-0 flex items-center justify-center h-2'
          >
            <div className='absolute top-1/2 -translate-y-1/2 flex gap-1 items-center'>
              {[...Array(dotCount)].map((_, i) => {
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
        <div className='text-xs flex flex-col items-center gap-0'>
          <ChevronUp className='size-3' />
          {value}
          {operator}
        </div>
      </div>
    </div>
  )
}
