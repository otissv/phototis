"use client"

import * as React from "react"
import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"

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
  RotateCcwSquare,
  RotateCwSquare,
  Square,
  Undo,
} from "lucide-react"

import type {
  ImageEditorHeaderProps,
  ImageEditorFooterProps,
} from "@/components/tools/utils.tools"
import { RotationControls } from "@/components/tools/rotation.tools"
import { ScaleControls } from "@/components/tools/scale.tools"
import { DimensionsControls } from "@/components/tools/dimensions.tools"
import { UpscaleControls } from "@/components/tools/upscale.tools"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { useWebGLDownload } from "@/components/useWebGLDownload"
import { useEditorContext } from "@/lib/editor/context"
import { Button } from "@/ui/button"
import { QualityOptions } from "./quaity-options.image-editor"
import {
  SharpenButton,
  SharpenControls,
} from "@/components/tools/sharpen.tools"

import { NoiseButton, NoiseControls } from "@/components/tools/noise.tools"
import { CropControls } from "@/components/tools/crop.tools"
import type {
  ToolValueCropType,
  ToolValueDimensionType,
  ToolValueNumberType,
} from "@/lib/tools/tools"
import { cn } from "@/lib/utils"
import { DimensionsCanvasControls } from "./tools/dimensions-canvas.tools"
import { MoveControls } from "@/components/tools/move.tools"

export function ImageEditorFooter({
  selectedSidebar,
  ...props
}: ImageEditorFooterProps & {
  selectedSidebar: keyof typeof SIDEBAR_TOOLS
}) {
  switch (selectedSidebar) {
    case "move":
      return <MoveFooter {...(props as MoveFooterProps)} />
    case "dimensionsCanvas":
      return (
        <DimensionsCanvasFooter {...(props as DimensionsCanvasFooterProps)} />
      )
    case "effects":
      return <EffectsFooter {...(props as EffectsFooterProps)} />
    case "rotate":
      return <RotateFooter {...(props as RotateFooterProps)} />
    case "dimensions":
      return <DimensionsFooter {...(props as DimensionsFooterProps)} />
    case "scale":
      return <ScaleFooter {...(props as ScaleFooterProps)} />
    case "upscale":
      return <UpscaleFooter {...(props as UpscaleFooterProps)} />
    case "crop":
      return <CropFooter {...(props as CropFooterProps)} />

    default:
      return null
  }
}

export interface EffectsFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "value"> & {
      value: ToolValueNumberType["defaultValue"]
    }
  > {}

export function EffectsFooter({
  canvasRef,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  value,
  dispatch,
  onProgress: _onProgress,
  onSelectedToolChange,
  ...props
}: EffectsFooterProps) {
  const { addKeyframe, state, getSelectedLayerId } = useEditorContext()
  const playheadTime = state.canonical.timeline.playheadTime || 0
  const selectedLayerId = getSelectedLayerId()

  const handleOnChange = React.useCallback(
    (value: number) => {
      // Write keyframe at current playhead time
      try {
        if (selectedLayerId) {
          addKeyframe(
            selectedLayerId,
            "filter",
            selectedTool,
            value,
            playheadTime
          )
        }
      } catch (error) {
        console.warn("Failed to add keyframe:", error)
      }
    },
    [addKeyframe, selectedTool, playheadTime, selectedLayerId]
  )

  const controlProps = {
    canvasRef,
    drawFnRef,
    progress,
    selectedLayer,
    selectedTool: "blur" as const, // Default to blur for effects footer
    toolsValues,
    value: toolsValues.blur,
    dispatch,
    onChange: handleOnChange,
  }

  const renderBlurControls = () => {
    if (selectedTool === "effects") {
      return (
        <div className='flex flex-col gap-4 mt-4'>
          <div className='flex gap-2 justify-center'>
            <ImageEditorButton
              variant='ghost'
              onClick={() =>
                selectedLayerId &&
                addKeyframe(
                  selectedLayerId,
                  "filter",
                  "blurType",
                  0,
                  playheadTime
                )
              }
              isActive={toolsValues?.blurType === 0}
              disabled={progress}
            >
              <ImageIcon size={16} className='mr-1' />
              Gaussian
            </ImageEditorButton>
            <ImageEditorButton
              variant='ghost'
              onClick={() =>
                selectedLayerId &&
                addKeyframe(
                  selectedLayerId,
                  "filter",
                  "blurType",
                  1,
                  playheadTime
                )
              }
              isActive={toolsValues?.blurType === 1}
              disabled={progress}
            >
              <Square size={16} className='mr-1' />
              Box
            </ImageEditorButton>
            <ImageEditorButton
              variant='ghost'
              onClick={() =>
                selectedLayerId &&
                addKeyframe(
                  selectedLayerId,
                  "filter",
                  "blurType",
                  2,
                  playheadTime
                )
              }
              isActive={toolsValues?.blurType === 2}
              disabled={progress}
            >
              <MoveHorizontal size={16} className='mr-1' />
              Motion
            </ImageEditorButton>
            <ImageEditorButton
              variant='ghost'
              onClick={() =>
                selectedLayerId &&
                addKeyframe(
                  selectedLayerId,
                  "filter",
                  "blurType",
                  3,
                  playheadTime
                )
              }
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
        <div className='max-w-lg w-full flex flex-col items-center justify-center'>
          <NoiseControls {...controlProps} />
          <SharpenControls {...controlProps} />
        </div>
      </div>
      <ul className='flex gap-6 w-full max-w-lg overflow-x-auto py-2'>
        <li>
          <ImageEditorButton isActive={true} variant='ghost' onClick={() => {}}>
            Blur
          </ImageEditorButton>
        </li>
        <li>
          <SharpenButton
            onSelectedToolChange={() => {}}
            selectedTool='sharpen'
            progress={progress}
          />
        </li>

        <li>
          <NoiseButton
            onSelectedToolChange={() => {}}
            selectedTool='noise'
            progress={progress}
          />
        </li>
      </ul>
      {renderBlurControls()}
    </div>
  )
}

export interface RotateFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "value"> & {
      value: ToolValueNumberType["defaultValue"]
    }
  > {}

/**
 * Rotate
 */
export function RotateFooter({
  canvasRef,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  dispatch,
  onProgress: _onProgress,
  onSelectedToolChange: _onSelectedToolChange,
  ...props
}: RotateFooterProps) {
  const {
    rotateDocument,
    flipDocument,
    addKeyframe,
    state,
    getSelectedLayerId,
  } = useEditorContext()
  const isDocumentLayer = selectedLayer?.id === "document"
  const playheadTime = state.canonical.timeline.playheadTime || 0
  const selectedLayerId = getSelectedLayerId()

  const safeRotate =
    typeof (toolsValues as any).rotate === "number"
      ? (toolsValues as any).rotate
      : 0
  const safeFlipH = Boolean((toolsValues as any)?.flipHorizontal)
  const safeFlipV = Boolean((toolsValues as any)?.flipVertical)

  const handleFlipHorizontal = () => {
    if (isDocumentLayer) {
      flipDocument({ horizontal: true })
      return
    }
    // Individual layer flip
    if (selectedLayerId) {
      addKeyframe(
        selectedLayerId,
        "filter",
        "flipHorizontal",
        safeFlipH ? 0 : 1,
        playheadTime
      )
    }
  }

  const handleFlipVertical = () => {
    if (isDocumentLayer) {
      flipDocument({ vertical: true })
      return
    }
    // Individual layer flip
    if (selectedLayerId) {
      addKeyframe(
        selectedLayerId,
        "filter",
        "flipVertical",
        safeFlipV ? 0 : 1,
        playheadTime
      )
    }
  }

  const handleOnChange = React.useCallback(
    (value: number) => {
      if (isDocumentLayer) {
        // Document rotation - rotate all layers by the difference
        const currentRotation = safeRotate
        const rotationDiff = value - currentRotation
        rotateDocument(rotationDiff)
      } else {
        // Individual layer rotation
        if (selectedLayerId) {
          addKeyframe(
            selectedLayerId,
            "filter",
            selectedTool as any,
            value,
            playheadTime
          )
        }
      }
    },
    [
      addKeyframe,
      selectedTool,
      isDocumentLayer,
      safeRotate,
      rotateDocument,
      playheadTime,
      selectedLayerId,
    ]
  )

  const Control = React.useMemo(() => {
    const controlProps = {
      canvasRef,
      drawFnRef,
      operator: "°",
      progress,
      selectedLayer,
      selectedTool: selectedTool === "effects" ? "rotate" : selectedTool,
      toolsValues,
      value: safeRotate, // Use the safe rotation value
      dispatch,
      onChange: handleOnChange,
    }
    switch (selectedTool) {
      case "rotate":
        return <RotationControls {...controlProps} />
      default:
        return null
    }
  }, [
    canvasRef,
    dispatch,
    drawFnRef,
    handleOnChange,
    progress,
    safeRotate, // Use safeRotate instead of value
    selectedLayer,
    selectedTool,
    toolsValues,
  ])

  return (
    <div {...props}>
      <div className='flex justify-center'>
        <div className='max-w-lg w-full flex flex-col items-center justify-center'>
          {Control}
        </div>
      </div>
      <ul className='flex gap-2 w-full justify-center'>
        <li className='flex items-center gap-1'>
          <ImageEditorButton
            title='Rotate image 90 degrees counter-clockwise'
            variant='ghost'
            onClick={() => rotateDocument(-90)}
            disabled={progress}
            aria-label='Rotate image 90 degrees counter-clockwise'
          >
            <RotateCcwSquare size={16} className='mr-1' />
            Rotate 90°
          </ImageEditorButton>
        </li>
        <li className='flex items-center gap-1'>
          <ImageEditorButton
            title='Rotate image 90 degrees clockwise°'
            variant='ghost'
            onClick={() => rotateDocument(90)}
            disabled={progress}
            aria-label='Rotate image 90 degrees clockwise'
          >
            <RotateCwSquare size={16} className='mr-1' />
            Rotate 90°
          </ImageEditorButton>
        </li>
        <li className='flex items-center gap-1'>
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

  const { history, addKeyframe, state, getSelectedLayerId } = useEditorContext()
  const playheadTime = state.canonical.timeline.playheadTime || 0

  const handleOnUndo = React.useCallback(() => {
    history.undo()
  }, [history])

  const handleOnRedo = React.useCallback(() => {
    history.redo()
  }, [history])

  const handleReset = React.useCallback(() => {
    // Reset all tool values to defaults at current playhead time
    try {
      const { TOOL_VALUES } = require("@/lib/tools/tools")
      const selectedLayerId = getSelectedLayerId()
      if (selectedLayerId) {
        for (const [key, toolValue] of Object.entries(TOOL_VALUES)) {
          if ("defaultValue" in (toolValue as any)) {
            addKeyframe(
              selectedLayerId,
              "filter",
              key,
              (toolValue as any).defaultValue,
              playheadTime
            )
          }
        }
      }
    } catch (error) {
      console.warn("Failed to reset keyframes:", error)
    }
  }, [addKeyframe, playheadTime, getSelectedLayerId])

  return (
    <ul className='flex gap-1 justify-center' {...props}>
      <li>
        <ImageEditorButton
          title='Reset'
          variant='ghost'
          onClick={handleReset}
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

export interface ScaleFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "value"> & {
      value: ToolValueNumberType["defaultValue"]
    }
  > {}

export function ScaleFooter({
  canvasRef,
  className,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  dispatch,
  onProgress,
  onSelectedToolChange,
  ...props
}: ScaleFooterProps) {
  const { addKeyframe, state, getSelectedLayerId } = useEditorContext()
  const playheadTime = state.canonical.timeline.playheadTime || 0
  const selectedLayerId = getSelectedLayerId()

  const handleOnChange = React.useCallback(
    (value: number) => {
      if (selectedLayerId) {
        addKeyframe(
          selectedLayerId,
          "filter",
          selectedTool as any,
          value,
          playheadTime
        )
      }
    },
    [addKeyframe, selectedTool, playheadTime, selectedLayerId]
  )

  const controlProps = {
    progress,
    selectedTool: selectedTool === "effects" ? "scale" : selectedTool,
    toolsValues,
    canvasRef,
    drawFnRef,
    selectedLayer,
    value: toolsValues.scale,
    dispatch,
    onProgress,
    onChange: handleOnChange,
    onSelectedToolChange,
  }

  return (
    <div className={cn("flex justify-center", className)} {...props}>
      <ScaleControls operator='%' isDecimal={true} {...controlProps} />
    </div>
  )
}

export interface DimensionsFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "value"> & {
      value: ToolValueDimensionType["defaultValue"]
    }
  > {}

export function DimensionsFooter({
  canvasRef,
  className,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  dispatch,
  onProgress,
  onSelectedToolChange: _onSelectedToolChange,
  ...props
}: DimensionsFooterProps) {
  const controlProps = {
    canvasRef,
    drawFnRef,
    progress,
    selectedLayer,
    selectedTool,
    toolsValues,
    value: toolsValues?.dimensions,
    dispatch,
    onProgress,
  }

  return (
    <div className={cn("flex justify-center", className)} {...props}>
      <DimensionsControls {...controlProps} />
    </div>
  )
}

export interface UpscaleFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "value"> & {
      value: ToolValueNumberType["defaultValue"]
    }
  > {}

export function UpscaleFooter({
  canvasRef,
  className,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  dispatch,
  onProgress,
  onSelectedToolChange: _onSelectedToolChange,
  ...props
}: UpscaleFooterProps) {
  const { addKeyframe, state, getSelectedLayerId } = useEditorContext()
  const playheadTime = state.canonical.timeline.playheadTime || 0
  const selectedLayerId = getSelectedLayerId()

  const handleOnChange = React.useCallback(
    (value: number) => {
      if (selectedLayerId) {
        addKeyframe(
          selectedLayerId,
          "filter",
          selectedTool as any,
          value,
          playheadTime
        )
      }
    },
    [addKeyframe, selectedTool, playheadTime, selectedLayerId]
  )

  const controlProps = {
    canvasRef,
    drawFnRef,
    progress,
    selectedLayer,
    selectedTool,
    toolsValues,
    value: toolsValues?.upscale,
    dispatch,
    onChange: handleOnChange,
    onProgress,
  }
  return (
    <div className={cn("flex justify-center", className)} {...props}>
      <UpscaleControls {...controlProps} />
    </div>
  )
}

export interface MoveFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "onChange" | "value"> & {
      value: ToolValueDimensionType["defaultValue"]
    }
  > {}

export function MoveFooter({
  canvasRef,
  className,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  dispatch,
  onProgress,
  onSelectedToolChange: _onSelectedToolChange,
  ...props
}: MoveFooterProps) {
  const controlProps = {
    canvasRef,
    drawFnRef,
    progress,
    selectedLayer,
    selectedTool,
    toolsValues,
    value: toolsValues?.dimensions,
    dispatch,
    onProgress,
  }

  return (
    <div className={cn("flex justify-center", className)} {...props}>
      <MoveControls value={controlProps.value} dispatch={dispatch} />
    </div>
  )
}

export interface CropFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "onChange" | "value"> & {
      value: ToolValueCropType["defaultValue"]
    }
  > {}

export function CropFooter({
  canvasRef,
  className,
  drawFnRef,
  progress,
  selectedLayer,
  selectedTool,
  toolsValues,
  dispatch,
  onProgress,
  onSelectedToolChange: _onSelectedToolChange,
  ...props
}: CropFooterProps) {
  const { addKeyframe, state, getSelectedLayerId } = useEditorContext()
  const playheadTime = state.canonical.timeline.playheadTime || 0
  const selectedLayerId = getSelectedLayerId()

  const handleOnChange = React.useCallback(
    (value: number) => {
      if (selectedLayerId) {
        addKeyframe(
          selectedLayerId,
          "filter",
          selectedTool as any,
          value,
          playheadTime
        )
      }
    },
    [addKeyframe, selectedTool, playheadTime, selectedLayerId]
  )

  const controlProps = {
    canvasRef,
    drawFnRef,
    progress,
    selectedLayer,
    selectedTool,
    toolsValues,
    value: toolsValues.crop,
    dispatch,
    onChange: handleOnChange,
    onProgress,
  }

  return (
    <div className={cn("flex justify-center", className)} {...props}>
      <CropControls {...controlProps} />
    </div>
  )
}

export interface DimensionsCanvasFooterProps
  extends Prettify<
    Omit<ImageEditorFooterProps, "onChange" | "value"> & {
      value: ToolValueDimensionType["defaultValue"]
    }
  > {}

export function DimensionsCanvasFooter({
  className,
  progress: _progress,
  selectedTool: _selectedTool,
  toolsValues: _toolsValues,
  canvasRef: _canvasRef,
  drawFnRef: _drawFnRef,
  selectedLayer: _selectedLayer,
  dispatch: _dispatch,
  onProgress: _onProgress,
  onSelectedToolChange: _onSelectedToolChange,
  ...props
}: DimensionsCanvasFooterProps) {
  return (
    <div className={cn("flex justify-center", className)} {...props}>
      <DimensionsCanvasControls />
    </div>
  )
}
