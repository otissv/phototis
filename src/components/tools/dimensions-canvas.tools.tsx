"use client"

import React from "react"
import { Expand, Link2, AlertCircle } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import type { ImageEditorFooterProps } from "@/components/tools/utils.tools"
import { useEditorContext } from "@/lib/editor/context"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import {
  ImageEditorButton,
  type ImageEditorButtonProps,
} from "@/components/button.image-editor"
import type { ImageLayer } from "@/lib/editor/state"
import { GPU_SECURITY_CONSTANTS } from "@/lib/security/gpu-security"

function DimensionsCanvasButton({
  onSelectedToolChange,
  selectedTool,
  progress,
}: ImageEditorButtonProps) {
  return (
    <ImageEditorButton
      variant='ghost'
      onClick={() => onSelectedToolChange("dimensionsCanvas")}
      isActive={selectedTool === "dimensionsCanvas"}
      disabled={progress}
      className='flex items-center gap-2'
    >
      <Expand className='h-4 w-4' />
      DimensionsCanvas
    </ImageEditorButton>
  )
}
DimensionsCanvasButton.displayName = "DimensionsCanvasButton"

type CanvasPosition =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "centerLeft"
  | "centerCenter"
  | "centerRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight"

function DimensionsCanvasControls({
  onChange,
  selectedLayer,
  dispatch,
  toolsValues,
}: Omit<ImageEditorFooterProps, "onSelectedToolChange">) {
  const { state, dimensionsDocument } = useEditorContext()
  const [width, setWidth] = React.useState<number>(
    state.canonical.document.width
  )
  const [height, setHeight] = React.useState<number>(
    state.canonical.document.height
  )
  const [originalAspectRatio, setOriginalAspectRatio] =
    React.useState<number>(1)
  const [preserveAspectRatio, setPreserveAspectRatio] =
    React.useState<boolean>(true)
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  )

  const [canvasPosition, setCanvasPosition] =
    React.useState<CanvasPosition>("centerCenter")

  const image = (selectedLayer as ImageLayer).image

  // Initialize from canonical.document
  React.useEffect(() => {
    const w = state.canonical.document.width
    const h = state.canonical.document.height
    if (w > 0 && h > 0) {
      setWidth(w)
      setHeight(h)
      setOriginalAspectRatio(w / h)
      setValidationError(null) // Clear any previous errors
    }
  }, [state.canonical.document.width, state.canonical.document.height])

  // Validate dimensions before applying changes
  const validateDimensions = (
    newWidth: number,
    newHeight: number
  ): string | null => {
    // Basic validation
    if (newWidth <= 0 || newHeight <= 0) {
      return "Dimensions must be positive numbers"
    }

    // Check against GPU security constants
    if (
      newWidth > GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE ||
      newHeight > GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    ) {
      return `Dimensions exceed maximum texture size (${GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE}px)`
    }

    // Calculate total area and check against reasonable limits
    const totalArea = newWidth * newHeight
    const maxArea =
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE *
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE

    // Allow up to 80% of the maximum possible area to leave room for other operations
    const maxAllowedArea = Math.floor(maxArea * 0.8)

    if (totalArea > maxAllowedArea) {
      return `Canvas area (${totalArea.toLocaleString()} pixels) exceeds maximum allowed area (${maxAllowedArea.toLocaleString()} pixels)`
    }

    // Check for reasonable limits to prevent browser crashes
    if (newWidth > 32768 || newHeight > 32768) {
      return "Dimensions are too large and may cause browser instability"
    }

    return null
  }

  const handleOnChange =
    (type: "width" | "height") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number.parseInt(e.target.value)
      if (Number.isNaN(newValue)) return

      let newWidth = width
      let newHeight = height

      if (type === "width") {
        newWidth = newValue
        if (preserveAspectRatio) {
          newHeight = Math.round(newWidth / originalAspectRatio)
        }
      } else {
        newHeight = newValue
        if (preserveAspectRatio) {
          newWidth = Math.round(newHeight * originalAspectRatio)
        }
      }

      // Validate dimensions before updating state
      const error = validateDimensions(newWidth, newHeight)
      if (error) {
        setValidationError(error)
        // Don't update the input values - keep the previous valid values
        return
      }

      // Clear any previous validation errors
      setValidationError(null)

      setWidth(newWidth)
      setHeight(newHeight)

      // Fire local onChange label handler if provided
      onChange?.(0 as any)

      // Update document dimensions - this will automatically trigger:
      // 1. Canvas size update
      // 2. Layer repositioning through the existing rendering system
      // 3. Redraw with new dimensions
      try {
        dimensionsDocument?.({ width: newWidth, height: newHeight })
      } catch (error) {
        // If the command fails, show the error and revert the local state
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update dimensions"
        setValidationError(errorMessage)

        // Revert to the previous valid dimensions
        setWidth(state.canonical.document.width)
        setHeight(state.canonical.document.height)
      }
    }

  const handleCanvasPositionChange = (position: CanvasPosition) => {
    setCanvasPosition(position)
    // No need to dispatch custom events anymore - position changes are handled
    // directly in handleOnChange when dimensions actually change
  }

  return (
    <div className='flex flex-col justify-center items-center gap-4 '>
      {/* Validation Error Display */}
      {validationError && (
        <div className='flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20'>
          <AlertCircle className='h-4 w-4' />
          <span>{validationError}</span>
        </div>
      )}

      <div className='grid grid-cols-3 grid-rows-3 border w-fit'>
        {/* Top left */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-b border-r transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("topLeft")}
        >
          {canvasPosition === "topLeft" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
        {/* Top center */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-b border-r transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("topCenter")}
        >
          {canvasPosition === "topCenter" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
        {/* Top right */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-b transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("topRight")}
        >
          <div className='h-8 w-8 ' />
          {canvasPosition === "topRight" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>

        {/* Middle left */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-b border-r transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("centerLeft")}
        >
          {canvasPosition === "centerLeft" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
        {/* Middle center */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8  border-b border-r transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("centerCenter")}
        >
          {canvasPosition === "centerCenter" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
        {/* Middle right */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-b transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("centerRight")}
        >
          <div className='h-8 w-8 ' />
          {canvasPosition === "centerRight" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>

        {/* Bottom left */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-r transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("bottomLeft")}
        >
          {canvasPosition === "bottomLeft" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
        {/* Bottom center */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8 border-r transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("bottomCenter")}
        >
          {canvasPosition === "bottomCenter" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
        {/* Bottom right */}
        <button
          type='button'
          className={cn(
            "relative h-8 w-8  transition-colors duration-100",
            "hover:bg-accent/50"
          )}
          onClick={() => handleCanvasPositionChange("bottomRight")}
        >
          {canvasPosition === "bottomRight" && (
            <motion.div
              layoutId='canvasIndicator'
              className='absolute inset-0 bg-accent'
            />
          )}
        </button>
      </div>

      <div className='grid grid-cols-[auto_auto_auto] justify-center items-center gap-x-2'>
        <div className='flex items-center gap-x-2'>
          {/* <label
            htmlFor='width'
            className='flex justify-center text-sm col-start-1 row-start-1'
          >
            Width
          </label> */}
          <Input
            id='width'
            aria-label='Width'
            type='number'
            min={1}
            max={GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE}
            className='col-start-1 row-start-2 w-20 rounded-none border-t-0 border-l-0 border-r-0 p-0 h-8'
            value={width}
            onChange={handleOnChange("width")}
          />
        </div>

        <Button
          variant='ghost'
          className={cn("rounded-full mx-2", {
            "bg-accent text-accent-foreground": preserveAspectRatio,
          })}
          size='icon'
          onClick={() => setPreserveAspectRatio(!preserveAspectRatio)}
        >
          <Link2
            className={cn("h-4 w-4", {
              "text-muted-foreground": !preserveAspectRatio,
            })}
          />
        </Button>
        <div className='flex items-center gap-x-2'>
          {/* <label
            htmlFor='height'
            className='flex justify-center text-sm col-start-3 row-start-1'
          >
            Height px
          </label> */}
          <Input
            id='height'
            type='number'
            min={1}
            max={GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE}
            className='col-start-3 row-start-2 w-20 rounded-none border-t-0 border-l-0 border-r-0'
            value={height}
            onChange={handleOnChange("height")}
          />
        </div>
      </div>

      {/* Dimension Limits Info */}
      <div className='text-xs text-muted-foreground text-center'>
        Max dimensions: {GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE}×
        {GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE}px
        <br />
        Max area:{" "}
        {Math.floor(
          GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE *
            GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE *
            0.8
        ).toLocaleString()}{" "}
        pixels
      </div>
    </div>
  )
}
DimensionsCanvasControls.displayName = "DimensionsCanvasControls"

export { DimensionsCanvasButton, DimensionsCanvasControls }
