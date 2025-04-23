"use client"

import * as React from "react"
import { type SIDEBAR_TOOLS, TOOL_VALUES } from "@/constants"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"

import { ImageEditorButton } from "./ImageEditorButton"
import {
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcwSquare,
  RotateCwSquare,
  Sun,
} from "lucide-react"
import type { ImageEditorToolsActions } from "./image-editor.state"
import SlidingTrack from "./sliding-track"
import { FilterPresets } from "./FilterPresets"

export interface ImageEditorFooterProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: number
  selectedTool: keyof typeof TOOL_VALUES
  dispatch: React.Dispatch<ImageEditorToolsActions>
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  onChange: (value: number) => void
  operator?: string
}

function onValueChange({
  selectedTool,
  onChange,
}: {
  selectedTool: keyof typeof TOOL_VALUES
  onChange: (value: number) => void
}) {
  return (value: number) => {
    const nextValue =
      value < TOOL_VALUES[selectedTool].min
        ? TOOL_VALUES[selectedTool].min
        : value
    onChange(nextValue)
  }
}

export function getEditorTools(selected: keyof typeof SIDEBAR_TOOLS) {
  switch (selected) {
    case "finetune":
      return {
        header: () => <></>,
        footer: (props: ImageEditorFooterProps) => (
          <FinetuneFooter {...props} />
        ),
      }
    case "filter":
      return {
        header: () => <></>,
        footer: (props: ImageEditorFooterProps) => <FilterFooter {...props} />,
      }

    default:
      return {
        header: (props: TransformHeaderProps) => <TransformHeader {...props} />,
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
            variant='ghost'
            onClick={() => onSelectedToolChange("brightness")}
            isActive={selectedTool === "brightness"}
          >
            Brightness
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "contrast"}
            variant='ghost'
            onClick={() => onSelectedToolChange("contrast")}
          >
            Contrast
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "saturation"}
            variant='ghost'
            onClick={() => onSelectedToolChange("saturation")}
          >
            Saturation
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "hue"}
            variant='ghost'
            onClick={() => onSelectedToolChange("hue")}
          >
            Hue
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "exposure"}
            variant='ghost'
            onClick={() => onSelectedToolChange("exposure")}
          >
            Exposure
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "temperature"}
            variant='ghost'
            onClick={() => onSelectedToolChange("temperature")}
          >
            Temperature
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "gamma"}
            variant='ghost'
            onClick={() => onSelectedToolChange("gamma")}
          >
            Gamma
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "vintage"}
            variant='ghost'
            onClick={() => onSelectedToolChange("vintage")}
          >
            vintage
          </ImageEditorButton>
        </li>
        {/* <li>
          <ImageEditorButton
            isActive={selectedTool === "sharpen"}
            variant='ghost'
            onClick={() => onSelectedToolChange("sharpen")}
          >
            Sharpen
          </ImageEditorButton>
        </li> */}
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
    </ImageEditorFooter>
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
            isActive={selectedTool === "filters"}
            variant='ghost'
            onClick={() => onSelectedToolChange("filters")}
          >
            Filters
          </ImageEditorButton>
        </li>

        <li>
          <ImageEditorButton
            isActive={selectedTool === "tint"}
            variant='ghost'
            onClick={() => onSelectedToolChange("tint")}
          >
            Tint
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "vibrance"}
            variant='ghost'
            onClick={() => onSelectedToolChange("vibrance")}
          >
            Vibrance
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "noise"}
            variant='ghost'
            onClick={() => onSelectedToolChange("noise")}
          >
            Noise
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "grain"}
            variant='ghost'
            onClick={() => onSelectedToolChange("grain")}
          >
            Grain
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "invert"}
            variant='ghost'
            onClick={() => onSelectedToolChange("invert")}
          >
            Invert
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "sepia"}
            variant='ghost'
            onClick={() => onSelectedToolChange("sepia")}
          >
            Sepia
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            isActive={selectedTool === "grayscale"}
            variant='ghost'
            onClick={() => onSelectedToolChange("grayscale")}
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
export interface TransformHeaderProps extends React.ComponentProps<"ul"> {
  selectedTool: keyof typeof TOOL_VALUES
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  toolsValues: typeof TOOL_VALUES
  dispatch: React.Dispatch<ImageEditorToolsActions>
}
export function TransformHeader({
  selectedTool,
  toolsValues,
  onSelectedToolChange,
  dispatch,
  ...props
}: TransformHeaderProps) {
  const [rotatePosition, setRotatePosition] = React.useState(0)

  const handleRotateLeft = () => {
    if (rotatePosition === 0) {
      setRotatePosition(1)
      dispatch({ type: "rotate", payload: 90 })
    } else if (rotatePosition === 1) {
      setRotatePosition(2)
      dispatch({ type: "rotate", payload: 180 })
    } else if (rotatePosition === 2) {
      setRotatePosition(3)
      dispatch({ type: "rotate", payload: 270 })
    } else if (rotatePosition === 3) {
      setRotatePosition(0)
      dispatch({ type: "rotate", payload: 0 })
    }
  }

  const handleFlipHorizontal = () => {
    dispatch({
      type: "flipHorizontal",
      payload: toolsValues.flipHorizontal ? 0 : 1,
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
        <ImageEditorButton variant='ghost' onClick={handleRotateLeft}>
          <RotateCwSquare size={16} className='mr-1' />
          Rotate 90°
        </ImageEditorButton>
      </li>
      <li>
        <ImageEditorButton variant='ghost' onClick={handleFlipHorizontal}>
          <FlipHorizontal2 size={16} className='mr-1' />
          Flip Horizontal
        </ImageEditorButton>
      </li>
      <li>
        <ImageEditorButton variant='ghost' onClick={handleFlipVertical}>
          <FlipVertical2 size={16} className='mr-1' />
          Flip Vertical
        </ImageEditorButton>
      </li>
      <li>
        <ImageEditorButton
          isActive={false}
          variant='ghost'
          onClick={() => onSelectedToolChange("crop")}
        >
          <Crop size={16} className='mr-1' />
          Crop
        </ImageEditorButton>
      </li>
    </ul>
  )
}

export function TransformFooter({
  selectedTool,
  onSelectedToolChange,
  value,
  dispatch,
  image,
  ...props
}: ImageEditorFooterProps) {
  const handleOnChange = (value: number) => {
    if (selectedTool === "rotate") {
      dispatch({ type: "rotate", payload: value })
    } else {
      dispatch({ type: "scale", payload: value })
    }
  }

  return (
    <ImageEditorFooter
      value={value}
      selectedTool={selectedTool}
      onChange={handleOnChange}
      operator={selectedTool === "rotate" ? "°" : "%"}
      {...props}
    >
      <ul className='flex gap-2 mt-10  justify-center'>
        <li>
          <ImageEditorButton
            variant='outline'
            onClick={() => onSelectedToolChange("rotate")}
            isActive={selectedTool === "rotate"}
          >
            Rotation
          </ImageEditorButton>
        </li>
        <li>
          <ImageEditorButton
            variant='outline'
            onClick={() => onSelectedToolChange("scale")}
            isActive={selectedTool === "scale"}
          >
            Scale
          </ImageEditorButton>
        </li>
      </ul>
    </ImageEditorFooter>
  )
}

export function ImageEditorFooter({
  selectedTool,
  value,
  className,
  children,
  onChange,
  operator,
  ...props
}: Omit<ImageEditorFooterProps, "dispatch" | "onSelectedToolChange">) {
  return (
    <div {...props} className={cn("w-full max-w-lg", className)}>
      <div className='m-4'>
        <label className='sr-only' htmlFor={`transform-slider-${selectedTool}`}>
          {selectedTool}
        </label>

        <SlidingTrack
          min={TOOL_VALUES[selectedTool].min}
          max={TOOL_VALUES[selectedTool].max}
          step={TOOL_VALUES[selectedTool].step}
          defaultValue={value}
          operator={operator}
          onValueChange={onValueChange({
            selectedTool,
            onChange: onChange,
          })}
        />
      </div>

      {children}
    </div>
  )
}
