"use client"

import * as React from "react"
import type { SIDEBAR_TOOLS } from "@/constants"

import { ImageEditorButton } from "./button.image-editor"
import {
  ChevronDown,
  CircleDot,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  History,
  ImageIcon,
  MoveHorizontal,
  Redo,
  RotateCwSquare,
  Square,
  Undo,
} from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { useWebGLDownload } from "@/components/image-editor/useWebGLDownload"
import { Button } from "../ui/button"
import { QualityOptions } from "./quaity-options.image-editor"
import { SharpenButton, SharpenControls } from "./tools/sharpen.tools"
import { TintButton, TintControls } from "./tools/tint.tools"
import { VibranceButton, VibranceControls } from "./tools/vibrance.tools"
import { GrainButton, GrainControls } from "./tools/grain.tools"
import { InvertButton, InvertControls } from "./tools/invert.tools"
import { SepiaButton, SepiaControls } from "./tools/sepia.tools"
import { GrayscaleButton, GrayscaleControls } from "./tools/grayscale.tools"

export function getEditorTools({
  selectedSidebar,
  canvasRef,
  drawFnRef,
}: {
  selectedSidebar: keyof typeof SIDEBAR_TOOLS
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
}) {
  switch (selectedSidebar) {
    case "finetune":
      return {
        header: (_props: ImageEditorHeaderProps) => <></>,
        footer: (props: ImageEditorFooterProps) => (
          <FinetuneFooter
            {...props}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        ),
      }
    case "filter":
      return {
        header: (_props: ImageEditorHeaderProps) => <></>,
        footer: (props: ImageEditorFooterProps) => (
          <PresetsFooter
            {...props}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        ),
      }
    case "upscale":
      return {
        header: (_props: ImageEditorHeaderProps) => <></>,
        footer: (props: ImageEditorFooterProps) => (
          <UpscaleFooter
            {...props}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        ),
      }

    default:
      return {
        header: (props: ImageEditorHeaderProps) => (
          <TransformHeader
            {...props}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        ),
        footer: (props: ImageEditorFooterProps) => (
          <TransformFooter
            {...props}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
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
  image,
  onChange: _onChange,
  onProgress: _onProgress,
  canvasRef,
  drawFnRef,
  ...props
}: ImageEditorFooterProps) {
  const handleOnChange = React.useCallback(
    (value: number) => {
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
        case "tint":
          return dispatch({ type: "tint", payload: value })
        case "vibrance":
          return dispatch({ type: "vibrance", payload: value })
        case "noise":
          return dispatch({ type: "noise", payload: value })
        case "grain":
          return dispatch({ type: "grain", payload: value })
        case "invert":
          return dispatch({ type: "invert", payload: value })
        case "sepia":
          return dispatch({ type: "sepia", payload: value })
        case "grayscale":
          return dispatch({ type: "grayscale", payload: value })
        default:
          return () => {}
      }
    },
    [dispatch, selectedTool]
  )

  const Control = React.useMemo(() => {
    const controlProps = {
      image,
      value,
      progress,
      selectedTool,
      label: (value: number, operator: string) => {
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
      case "sharpen":
        return <SharpenControls {...controlProps} />
      case "tint":
        return <TintControls {...controlProps} />
      case "vibrance":
        return <VibranceControls {...controlProps} />
      case "grain":
        return <GrainControls {...controlProps} />
      case "invert":
        return <InvertControls {...controlProps} />
      case "sepia":
        return <SepiaControls {...controlProps} />
      case "grayscale":
        return <GrayscaleControls {...controlProps} />
    }
  }, [selectedTool, value, progress, handleOnChange, image])

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
            </div>
          )}

          {toolsValues?.blurType === 3 && (
            <div className='flex flex-col gap-2'>
              <span className='text-sm text-muted-foreground'>Center</span>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div {...props}>
      <div className='flex justify-center overflow-x-auto '>
        <div className='max-w-lg'>{Control}</div>
      </div>
      <ul className='flex gap-6 w-full max-w-lg overflow-x-auto py-2'>
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
        <li>
          <SharpenButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <TintButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <VibranceButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        {/* <li>
          <NoiseButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li> */}
        <li>
          <GrainButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <InvertButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <SepiaButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
        <li>
          <GrayscaleButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
          />
        </li>
      </ul>
      {renderBlurControls()}
    </div>
  )
}

/**
 * Presets
 */
export function PresetsFooter({
  className,
  selectedTool,
  value,
  onSelectedToolChange,
  dispatch,
  image,
  progress,
  ...props
}: ImageEditorFooterProps) {
  const handleOnChange = React.useCallback(
    (value: number) => {
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
    },
    [dispatch, selectedTool]
  )

  return (
    <div>
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
    </div>
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
  canvasRef,
  drawFnRef,
  ...props
}: ImageEditorHeaderProps) {
  const [isOptionsOpen, setIsOptionsOpen] = React.useState(false)
  const [jpegQuality, setJpegQuality] = React.useState(80)
  const [webpQuality, setWebpQuality] = React.useState(80)

  const downloadImage = useWebGLDownload(canvasRef, drawFnRef)

  const handleOnDownload = React.useCallback(
    (mimeType: string, quality?: number) => () => {
      downloadImage(mimeType, quality ? quality / 100 : undefined)
    },
    [downloadImage]
  )

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

  const handleOnUndo = React.useCallback(() => {
    dispatch({ type: "undo" })
  }, [dispatch])

  const handleOnRedo = React.useCallback(() => {
    dispatch({ type: "redo" })
  }, [dispatch])

  return (
    <ul className='flex gap-1 justify-center' {...props}>
      <li>
        <ImageEditorButton
          title='Reset'
          variant='ghost'
          onClick={() => {
            dispatch({ type: "reset" })
          }}
          disabled={progress}
        >
          <History size={16} />
          Reset
        </ImageEditorButton>
      </li>

      <li className='flex items-center gap-1'>
        <div className='w-[1px] h-6 bg-muted' />

        <ImageEditorButton
          title='Undo last action'
          variant='ghost'
          onClick={handleOnUndo}
          disabled={progress}
        >
          <Undo size={16} className='mr-1' />
          Undo
        </ImageEditorButton>
      </li>
      <li className='flex items-center gap-1'>
        <ImageEditorButton
          title='Redo last action'
          variant='ghost'
          onClick={handleOnRedo}
          disabled={progress}
        >
          <Redo size={16} className='mr-1' />
          Redo
        </ImageEditorButton>
      </li>
      <li className='flex items-center gap-1'>
        <div className='w-[1px] h-6 bg-muted' />

        <ImageEditorButton
          title='Rotate image 90°'
          variant='ghost'
          onClick={handleRotateLeft}
          disabled={progress}
        >
          <RotateCwSquare size={16} className='mr-1' />
          Rotate 90°
        </ImageEditorButton>
      </li>
      <li className='flex items-center gap-1'>
        <div className='w-[1px] h-6 bg-muted' />

        <ImageEditorButton
          title='Flip image horizontally'
          variant='ghost'
          onClick={handleFlipHorizontal}
          disabled={progress}
        >
          <FlipHorizontal2 size={16} className='mr-1' />
          Flip Horizontal
        </ImageEditorButton>
      </li>
      <li className='flex items-center gap-1'>
        <ImageEditorButton
          title='Flip image vertically'
          variant='ghost'
          onClick={handleFlipVertical}
          disabled={progress}
        >
          <FlipVertical2 size={16} className='mr-1' />
          Flip Vertical
        </ImageEditorButton>
      </li>

      <li className='flex items-center gap-1'>
        <div className='w-[1px] h-6 bg-muted' />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              title='Download image'
              variant='ghost'
              className='rounded-sm gap-2 text-xs'
            >
              <Download size={16} />
              Download <ChevronDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <QualityOptions
              description='Configure your download quality. These settings will affect the final file size and image quality of your download.'
              title='JPEG Download Options'
              isOpen={isOptionsOpen}
              setIsOpen={setIsOptionsOpen}
              quality={jpegQuality}
              setQuality={setJpegQuality}
              onClick={handleOnDownload("image/jpeg", jpegQuality)}
            >
              JPEG
            </QualityOptions>
            <QualityOptions
              description='Configure your download quality. These settings will affect the final file size and image quality of your download.'
              title='WebP Download Options'
              isOpen={isOptionsOpen}
              setIsOpen={setIsOptionsOpen}
              quality={webpQuality}
              setQuality={setWebpQuality}
              onClick={handleOnDownload("image/webp", webpQuality)}
            >
              WebP
            </QualityOptions>
            <DropdownMenuItem
              title='Download as PNG'
              onClick={handleOnDownload("image/png")}
            >
              Png
            </DropdownMenuItem>

            <DropdownMenuItem
              title='Download as GIF'
              onClick={handleOnDownload("image/gif")}
            >
              GIF
            </DropdownMenuItem>
            <DropdownMenuItem
              title='Download as AVIF'
              onClick={handleOnDownload("image/avif")}
            >
              AVIF
            </DropdownMenuItem>
            <DropdownMenuItem
              title='Download as ICO'
              onClick={handleOnDownload("image/ico")}
            >
              ICO
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
  )
}

export function TransformFooter({
  image,
  progress,
  selectedTool,
  toolsValues,
  value,
  dispatch,
  onSelectedToolChange,
  canvasRef,
  drawFnRef,
  ...props
}: Omit<ImageEditorFooterProps, "onChange" | "onProgress">) {
  const handleOnChange = React.useCallback(
    (value: number) => {
      dispatch({ type: selectedTool, payload: value })
    },
    [dispatch, selectedTool]
  )

  let operator = ""

  if (selectedTool === "rotate") {
    operator = "°"
  } else if (selectedTool === "scale") {
    operator = "%"
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleOnChange causes infinite loop
  const Control = React.useMemo(() => {
    const controlProps = {
      image,
      value,
      progress,
      operator,
      selectedTool,
      label: (value: number, operator: string) => {
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
        return (
          <ResizeControls
            {...controlProps}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        )
    }
  }, [selectedTool, value, operator, progress, handleOnChange, image])

  return (
    <div {...props}>
      <div className='flex justify-center'>
        <div className='max-w-lg'>{Control}</div>
      </div>
      <ul className='flex gap-2 w-full justify-center'>
        <li>
          <RotationButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        </li>
        <li>
          <ScaleButton
            onSelectedToolChange={onSelectedToolChange}
            selectedTool={selectedTool}
            progress={progress}
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
          />
        </li>

        <li>
          <ResizeButton
            canvasRef={canvasRef}
            drawFnRef={drawFnRef}
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
  image,
  progress,
  selectedTool,
  toolsValues,
  value,
  dispatch,
  onSelectedToolChange,
  ...props
}: Omit<ImageEditorFooterProps, "onChange" | "onProgress">) {
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
