"use client"

import React from "react"
import { Slider } from "@/ui/slider"
import { useEditorContext } from "@/lib/editor/context"
import { TOOL_VALUES } from "@/lib/state.image-editor"

export interface BrightnessControlsProps {
  className?: string
}

export function BrightnessControls({ className }: BrightnessControlsProps) {
  const { history, getSelectedLayerId, state, updateAdjustmentParameters } =
    useEditorContext()
  const selectedLayerId = getSelectedLayerId()
  const selectedLayer = selectedLayerId
    ? state.canonical.layers.byId[selectedLayerId]
    : null

  // Check if the selected layer is an adjustment layer
  const isAdjustmentLayer = selectedLayer?.type === "adjustment"
  const adjustmentType = isAdjustmentLayer
    ? (selectedLayer as any).adjustmentType
    : null

  // If it's a brightness adjustment layer, show the controls
  if (isAdjustmentLayer && adjustmentType === "brightness") {
    const parameters = (selectedLayer as any).parameters
    const brightness = parameters?.brightness ?? 100

    const handleBrightnessChange = (value: number[]) => {
      if (selectedLayerId) {
        updateAdjustmentParameters(selectedLayerId, { brightness: value[0] })
      }
    }

    return (
      <div className={className}>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <div className='text-sm font-medium'>
              Brightness Adjustment Layer
            </div>
            <div className='space-y-2'>
              <Slider
                value={[brightness]}
                onValueChange={handleBrightnessChange}
                min={TOOL_VALUES.brightness.min}
                max={TOOL_VALUES.brightness.max}
                step={TOOL_VALUES.brightness.step}
                className='w-full'
                aria-label='Brightness adjustment value'
              />
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>{TOOL_VALUES.brightness.min}</span>
                <span>{brightness}</span>
                <span>{TOOL_VALUES.brightness.max}</span>
              </div>
            </div>
          </div>
          <div className='text-xs text-muted-foreground'>
            This is a brightness adjustment layer. Changes affect all layers
            below it.
          </div>
        </div>
      </div>
    )
  }

  // Original brightness tool for image layers
  const toolsValues =
    selectedLayer?.type === "image" ? (selectedLayer as any).filters || {} : {}
  const brightness = toolsValues.brightness ?? 100

  const handleBrightnessChange = (value: number[]) => {
    if (selectedLayerId) {
      // For now, just update the layer directly
      // TODO: Implement proper dispatch for image layer filters
      console.log("Brightness change for image layer:", value[0])
    }
  }

  return (
    <div className={className}>
      <div className='space-y-4'>
        <div className='space-y-2'>
          <div className='text-sm font-medium'>Brightness</div>
          <div className='space-y-2'>
            <Slider
              value={[brightness]}
              onValueChange={handleBrightnessChange}
              min={TOOL_VALUES.brightness.min}
              max={TOOL_VALUES.brightness.max}
              step={TOOL_VALUES.brightness.step}
              className='w-full'
              aria-label='Brightness value'
            />
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>{TOOL_VALUES.brightness.min}</span>
              <span>{brightness}</span>
              <span>{TOOL_VALUES.brightness.max}</span>
            </div>
          </div>
        </div>
        <div className='text-xs text-muted-foreground'>
          Adjust the brightness of the selected image layer.
        </div>
      </div>
    </div>
  )
}
