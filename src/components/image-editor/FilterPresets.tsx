"use client"

import React from "react"
import { motion, useMotionValue } from "motion/react"

import { FILTER_PRESETS } from "@/lib/filters"
import { cn } from "@/lib/utils"
import type { ImageEditorToolsActions } from "./state.image-editor"
import { ImageEditorCanvas } from "./canvas-image-editor"

interface FilterPresetsProps {
  className?: string
  dispatch: React.Dispatch<ImageEditorToolsActions>
  selectedPreset?: string
  onSelectPreset?: (preset: string) => void
  image: File
}

export function FilterPresets({
  className,
  dispatch,
  selectedPreset,
  onSelectPreset,
  image,
}: FilterPresetsProps) {
  const x = useMotionValue(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  console.log(x)

  React.useEffect(() => {
    const unsubscribe = x.on("change", (latest) => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = -latest
      }
    })
    return () => unsubscribe()
  }, [x])

  const handlePresetClick = (preset: (typeof FILTER_PRESETS)[number]) => {
    // Apply all filter values from the preset
    Object.entries(preset.values).forEach(([key, value]) => {
      if (typeof value === "number") {
        dispatch({ type: key as keyof typeof preset.values, payload: value })
      }
    })
    onSelectPreset?.(preset.name)
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div ref={containerRef} className='overflow-x-auto max-w-5xl'>
        <motion.div
          className='flex cursor-grab active:cursor-grabbing'
          drag='x'
          dragConstraints={containerRef}
          // dragElastic={0.2}
          // dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
          style={{ x }}
        >
          {FILTER_PRESETS.map((preset) => {
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
              <div
                // biome-ignore lint/a11y/useSemanticElements: <explanation>
                role='button'
                tabIndex={0}
                key={preset.name}
                className='flex flex-col items-center justify-center p-2 h-auto min-w-[90px] rounded-lg'
                onClick={() => handlePresetClick(preset)}
                title={preset.description}
              >
                <div className='w-full aspect-square mb-2 bg-muted rounded-md overflow-hidden'>
                  <ImageEditorCanvas
                    image={image}
                    toolsValues={preset.values}
                  />
                </div>
                <span className='text-xs'>{preset.name}</span>
              </div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
