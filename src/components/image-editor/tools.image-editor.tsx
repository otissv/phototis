"use client"

import * as React from "react"
import { type SIDEBAR_TOOLS, TOOL_VALUES } from "@/constants"
import { cn, onToolControlValueChange } from "@/lib/utils"

import { ImageEditorButton } from "./button-image-editor"
import {
  FlipHorizontal2,
  FlipVertical2,
  RotateCwSquare,
  ImageIcon,
  Square,
  MoveHorizontal,
  CircleDot,
} from "lucide-react"
import type {
  ImageEditorToolsActions,
  ImageEditorToolsState,
} from "./state.image-editor"
import SlidingTrack from "../sliding-track"
import type {
  ImageEditorHeaderProps,
  ImageEditorFooterProps,
} from "./tools/utils.tools"
import { RotationButton, RotationControls } from "./tools/rotation.tools"
import { ScaleButton, ScaleControls } from "./tools/scale.tools"
import { ResizeButton, ResizeControls } from "./tools/resize.tools"
import { UpscaleButton } from "./tools/upscale.tools"
import { BrightnessButton, BrightnessControls } from "./tools/brightness.tools"
import { ContrastButton, ContrastControls } from "./tools/contrast.tools"
import { SaturationButton, SaturationControls } from "./tools/saturation.tools"
import { HueButton, HueControls } from "./tools/hue.tools"
import { ExposureButton, ExposureControls } from "./tools/exposure.tools"
import {
  TemperatureButton,
  TemperatureControls,
} from "./tools/temperature.tools"
import { GammaButton, GammaControls } from "./tools/gamma.tools"
import { VintageButton, VintageControls } from "./tools/vintage.tools"

export function getEditorTools(selected: keyof typeof SIDEBAR_TOOLS) {
  switch (selected) {
    case "finetune":
      return {
        header: (_props: ImageEditorHeaderProps) => <></>,
        footer: (props: ImageEditorFooterProps) => (
          <FinetuneFooter {...props} />
        ),
      }
    case "filter":
      return {
        header: (_props: ImageEditorHeaderProps) => <></>,
        footer: (props: ImageEditorFooterProps) => <FilterFooter {...props} />,
      }
    case "upscale":
      return {
        header: (_props: ImageEditorHeaderProps) => <></>,
        footer: (props: ImageEditorFooterProps) => <UpscaleFooter {...props} />,
      }

    default:
      return {
        header: (props: ImageEditorHeaderProps) => (
          <TransformHeader {...props} />
        ),
        footer: (props: ImageEditorFooterProps) => (
          <TransformFooter {...props} />
        ),
      }
  }
}

/**
 * Finetune
 */

export function FinetuneFooter({
  selectedTool,
  value,
  onSelectedToolChange,
  dispatch,
  toolsValues,
  progress,
  ...props
}: ImageEditorFooterProps) {
  const handleOnChange = (value: number) => {
    switch (selectedTool) {
      case "brightness":
        return dispatch({ type: "brightness", payload: value })
      case "contrast":
        return dispatch({ type: "contrast", payload: value })
      case "hue":
        return dispatch({ type: "hue", payload: value })
      case "saturation":
        return dispatch({ type: "saturation", payload: value })
      case "exposure":
        return dispatch({ type: "exposure", payload: value })
      case "temperature":
        return dispatch({ type: "temperature", payload: value })
      case "gamma":
        return dispatch({ type: "gamma", payload: value })
      case "vintage":
        return dispatch({ type: "vintage", payload: value })
      case "sharpen":
        return dispatch({ type: "sharpen", payload: value })
      case "blur":
        return dispatch({ type: "blur", payload: value })
      case "blurType":
        return dispatch({ type: "blurType", payload: value })
      case "blurDirection":
        return dispatch({ type: "blurDirection", payload: value })
      case "blurCenter":
        return dispatch({ type: "blurCenter", payload: value })
      default:
        return () => {}
    }
  }

  const Control = React.useMemo(() => {
    const controlProps = {
      value,
      progress,
      selectedTool,
      label: (value, operator) => {
        if (selectedTool === "rotate") {
          return `${Math.round(value)} ${operator}`
        }
        return `${Math.round(value)} ${operator}`
      },
      onChange: handleOnChange,
    }
    switch (selectedTool) {
      case "brightness":
        return <BrightnessControls {...controlProps} />
      case "contrast":
        return <ContrastControls {...controlProps} />
      case "hue":
        return <HueControls {...controlProps} />
      case "saturation":
        return <SaturationControls {...controlProps} />
      case "exposure":
        return <ExposureControls {...controlProps} />
      case "temperature":
        return <TemperatureControls {...controlProps} />
      case "gamma":
        return <GammaControls {...controlProps} />
      case "vintage":
        return <VintageControls {...controlProps} />
    }
  }, [selectedTool, value, progress])

  const renderBlurControls = () => {
    if (selectedTool === "blur") {
      return (
        <div className='flex flex-col gap-4 mt-4'>
          <div className='flex gap-2 justify-center'>
            <ImageEditorButton
              variant='ghost'
              onClick={() => dispatch({ type: "blurType", payload: 0 })}
              isActive={toolsValues?.blurType === 0}
              disabled={progress}
            >
              <ImageIcon size={16} className='mr-1' />
              Gaussian
            </ImageEditorButton>
            <ImageEditorButton
              variant='ghost'
              onClick={() => dispatch({ type: "blurType", payload: 1 })}
              isActive={toolsValues?.blurType === 1}
              disabled={progress}
            >
              <Square size={16} className='mr-1' />
              Box
            </ImageEditorButton>
            <ImageEditorButton
              variant='ghost'
              onClick={() => dispatch({ type: "blurType", payload: 2 })}
              isActive={toolsValues?.blurType === 2}
              disabled={progress}
            >
              <MoveHorizontal size={16} className='mr-1' />
              Motion
            </ImageEditorButton>
            <ImageEditorButton
              variant='ghost'
              onClick={() => dispatch({ type: "blurType", payload: 3 })}
              isActive={toolsValues?.blurType === 3}
              disabled={progress}
            >
              <CircleDot size={16} className='mr-1' />
              Radial
            </ImageEditorButton>
          </div>

          {toolsValues?.blurType === 2 && (
            <div className='flex flex-col gap-2'>
              <span className='text-sm text-muted-foreground'>Direction</span>
              <SlidingTrack
                min={TOOL_VALUES.blurDirection.min}
                max={TOOL_VALUES.blurDirection.max}
                step={TOOL_VALUES.blurDirection.step}
                defaultValue={toolsValues?.blurDirection || 0}
                operator='°'
                onToolControlValueChange={(value) =>
                  dispatch({ type: "blurDirection", payload: value })
                }
                disabled={progress}
              />
            </div>
          )}

          {toolsValues?.blurType === 3 && (
            <div className='flex flex-col gap-2'>
              <span className='text-sm text-muted-foreground'>Center</span>
              <SlidingTrack
                min={TOOL_VALUES.blurCenter.min}
                max={TOOL_VALUES.blurCenter.max}
                step={TOOL_VALUES.blurCenter.step}
                defaultValue={toolsValues?.blurCenter || 0.5}
                onToolControlValueChange={(value) =>
                  dispatch({ type: "blurCenter", payload: value })
                }
                disabled={progress}
              />
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div {...props}>
      <div className='flex justify-center'>
        <div className='max-w-lg'>{Control}</div>
      </div>
      <ul className='flex gap-6 mt-10 w-full justify-center'>
        <li>
          <BrightnessButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <ContrastButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <HueButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <SaturationButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <ExposureButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <TemperatureButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <GammaButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <VintageButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>

        <li>
          <ImageEditorButton
            isActive={selectedTool === "blur"}
            variant='ghost'
            onClick={() => onSelectedToolChange("blur")}
          >
            Blur
          </ImageEditorButton>
        </li>
      </ul>
      {renderBlurControls()}
    </div>
  )
}

/**
 * Filter
 */
export function FilterFooter({
  className,
  selectedTool,
  value,
  onSelectedToolChange,
  dispatch,
  image,
  progress,
  ...props
}: ImageEditorFooterProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<string>("Normal")

  const handleOnChange = (value: number) => {
    switch (selectedTool) {
      case "tint":
        return dispatch({ type: "tint", payload: value })
      case "vibrance":
        return dispatch({ type: "vibrance", payload: value })
      case "noise":
        return dispatch({ type: "noise", payload: value })
      case "grain":
        return dispatch({ type: "grain", payload: value })
      case "sharpen":
        return dispatch({ type: "sharpen", payload: value })
      case "invert":
        return dispatch({ type: "invert", payload: value })
      case "sepia":
        return dispatch({ type: "sepia", payload: value })
      case "grayscale":
        return dispatch({ type: "grayscale", payload: value })
      default:
        return () => {}
    }
  }

  return (
    <ImageEditorFooter
      value={value}
      selectedTool={selectedTool}
      onChange={handleOnChange}
      {...props}
    >
      <ul className='flex gap-2 mt-10  justify-center'>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "tint"}
            variant='ghost'
            onClick={() => onSelectedToolChange("tint")}
            disabled={progress}
          >
            Tint
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "vibrance"}
            variant='ghost'
            onClick={() => onSelectedToolChange("vibrance")}
            disabled={progress}
          >
            Vibrance
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "noise"}
            variant='ghost'
            onClick={() => onSelectedToolChange("noise")}
            disabled={progress}
          >
            Noise
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "grain"}
            variant='ghost'
            onClick={() => onSelectedToolChange("grain")}
            disabled={progress}
          >
            Grain
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "invert"}
            variant='ghost'
            onClick={() => onSelectedToolChange("invert")}
            disabled={progress}
          >
            Invert
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "sepia"}
            variant='ghost'
            onClick={() => onSelectedToolChange("sepia")}
            disabled={progress}
          >
            Sepia
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "grayscale"}
            variant='ghost'
            onClick={() => onSelectedToolChange("grayscale")}
            disabled={progress}
          >
            Grayscale
          </ImageEditorButton>
        </li>
      </ul>
    </ImageEditorFooter>
  )
}

/**
 * Transform
 */

export function TransformHeader({
  selectedTool,
  toolsValues,
  onSelectedToolChange,
  dispatch,
  progress,
  onProgress,
  ...props
}: ImageEditorHeaderProps) {
  const handleRotateLeft = () => {
    const currentRotation =
      typeof toolsValues.rotate === "number" ? toolsValues.rotate : 0
    // Invert rotation direction if image is flipped horizontally
    const rotationDirection = toolsValues.flipHorizontal ? -90 : 90
    const newRotation = (currentRotation + rotationDirection + 360) % 360
    dispatch({ type: "rotate", payload: newRotation })
  }

  const handleFlipHorizontal = () => {
    const isCurrentlyFlipped = toolsValues.flipHorizontal
    const currentRotation =
      typeof toolsValues.rotate === "number" ? toolsValues.rotate : 0

    // When flipping horizontally, we need to invert the rotation
    const newRotation = (360 - currentRotation) % 360

    dispatch({
      type: "flipHorizontal",
      payload: isCurrentlyFlipped ? 0 : 1,
    })

    // Update rotation to match the flipped state
    dispatch({
      type: "rotate",
      payload: newRotation,
    })
  }

  const handleFlipVertical = () => {
    dispatch({
      type: "flipVertical",
      payload: toolsValues.flipVertical ? 0 : 1,
    })
  }

  return (
    <ul className='flex gap-2 justify-center' {...props}>
      <li>
        <ImageEditorButton
          variant='ghost'
          onClick={handleRotateLeft}
          disabled={progress}
        >
          <RotateCwSquare size={16} className='mr-1' />
          Rotate 90°
        </ImageEditorButton>
      </li>
      <li>
        <ImageEditorButton
          variant='ghost'
          onClick={handleFlipHorizontal}
          disabled={progress}
        >
          <FlipHorizontal2 size={16} className='mr-1' />
          Flip Horizontal
        </ImageEditorButton>
      </li>
      <li>
        <ImageEditorButton
          variant='ghost'
          onClick={handleFlipVertical}
          disabled={progress}
        >
          <FlipVertical2 size={16} className='mr-1' />
          Flip Vertical
        </ImageEditorButton>
      </li>
    </ul>
  )
}

export function TransformFooter({
  className,
  image,
  progress,
  selectedTool,
  toolsValues,
  value,
  dispatch,
  onSelectedToolChange,
  ...props
}: ImageEditorFooterProps) {
  const handleOnChange = (value: number) => {
    if (selectedTool === "rotate") {
      dispatch({ type: "rotate", payload: value })
    } else if (selectedTool === "scale") {
      dispatch({ type: "scale", payload: value })
    } else if (selectedTool === "upscale") {
      dispatch({ type: "upscale", payload: value })
    }
  }

  let operator = ""

  if (selectedTool === "rotate") {
    operator = "°"
  } else if (selectedTool === "scale") {
    operator = "%"
  }

  const Control = React.useMemo(() => {
    const controlProps = {
      value,
      progress,
      operator,
      selectedTool,
      label: (value, operator) => {
        if (selectedTool === "rotate") {
          return `${Math.round(value)} ${operator}`
        }
        return `${Math.round(value)} ${operator}`
      },
      onChange: handleOnChange,
    }
    switch (selectedTool) {
      case "rotate":
        return <RotationControls {...controlProps} />
      case "scale":
        return <ScaleControls {...controlProps} />
      case "resize":
        return <ResizeControls {...controlProps} />
    }
  }, [selectedTool, value, operator, progress])

  return (
    <div {...props}>
      <div className='flex justify-center'>
        <div className='max-w-lg'>{Control}</div>
      </div>
      <ul className='flex gap-6 mt-10 w-full justify-center'>
        <li>
          <RotationButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <ScaleButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>

        <li>
          <ResizeButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
      </ul>
    </div>
  )
}

export function UpscaleFooter({
  className,
  image,
  progress,
  selectedTool,
  toolsValues,
  value,
  dispatch,
  onSelectedToolChange,
  ...props
}: ImageEditorFooterProps) {
  return (
    <div className='flex justify-center ' {...props}>
      <UpscaleButton
        value={toolsValues?.upscale || 0}
        dispatch={dispatch}
        progress={progress}
      />
    </div>
  )
}

export function ImageEditorFooter({
  children,
  className,
  operator,
  selectedTool,
  value,
  label,
  onChange,
  progress,
  ...props
}: Omit<ImageEditorFooterProps, "dispatch" | "onSelectedToolChange">) {
  return (
    <div {...props} className={cn("w-full max-w-lg", className)}>
      <div className='m-4'>
        <span className='sr-only'>{selectedTool}</span>

        <SlidingTrack
          min={TOOL_VALUES[selectedTool].min}
          max={TOOL_VALUES[selectedTool].max}
          step={TOOL_VALUES[selectedTool].step}
          defaultValue={value}
          operator={operator}
          onToolControlValueChange={onToolControlValueChange({
            selectedTool,
            onChange: onChange || (() => {}),
          })}
          label={label}
          disabled={progress}
        />
      </div>

      {children}
    </div>
  )
}
