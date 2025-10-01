"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ChevronDown,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  History,
  Redo,
  RotateCcwSquare,
  RotateCwSquare,
  Undo,
} from "lucide-react"

import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"
import { ImageEditorButton } from "@/components/button.image-editor"
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
import { QualityOptions } from "@/components/quality-options.image-editor"

import { CropControls } from "@/components/tools/crop.tools"
import type {
  ToolValueCropType,
  ToolValueDimensionType,
  ToolValueNumberType,
} from "@/lib/tools/tools"
import { cn } from "@/lib/utils"
import { DimensionsCanvasControls } from "@/components/tools/dimensions-canvas.tools"
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
  const { rotateDocument, flipDocument, getPlayheadTime } = useEditorContext()
  const t = getPlayheadTime()
  const isDocumentLayer = selectedLayer?.id === "document"

  const sampleMaybeTrack = (v: any) => {
    try {
      if (v && typeof v === "object" && Array.isArray(v.kfs)) {
        const { sampleTrack } = require("@/lib/tools/tools") as any
        return sampleTrack(v, t)
      }
    } catch {}
    return v
  }

  const safeRotate = Number(sampleMaybeTrack((toolsValues as any).rotate) || 0)
  const safeFlipH = Boolean(
    sampleMaybeTrack((toolsValues as any)?.flipHorizontal)
  )
  const safeFlipV = Boolean(
    sampleMaybeTrack((toolsValues as any)?.flipVertical)
  )

  const handleRotateLeft = () => {
    if (isDocumentLayer) {
      // Document rotation - rotate all layers
      rotateDocument(-90)
    } else {
      // Individual layer rotation
      const currentRotation = safeRotate
      // Invert rotation direction if image is flipped horizontally
      const rotationDirection = safeFlipH ? -90 : 90
      const newRotation = (currentRotation + rotationDirection + 360) % 360
      dispatch({ type: "rotate", payload: newRotation, t: 0 })
    }
  }

  const handleRotateRight = () => {
    if (isDocumentLayer) {
      // Document rotation - rotate all layers
      rotateDocument(90)
    } else {
      // Individual layer rotation
      const currentRotation = safeRotate
      // Invert rotation direction if image is flipped horizontally
      const rotationDirection = safeFlipH ? 90 : -90
      const newRotation = (currentRotation + rotationDirection + 360) % 360
      dispatch({ type: "rotate", payload: newRotation, t: 0 })
    }
  }

  const handleFlipHorizontal = () => {
    if (isDocumentLayer) {
      flipDocument({ horizontal: true })
      return
    }
    // Individual layer flip
    dispatch({
      type: "flipHorizontal",
      payload: safeFlipH ? 0 : 1,
      t: 0,
    } as any)
  }

  const handleFlipVertical = () => {
    if (isDocumentLayer) {
      flipDocument({ vertical: true })
      return
    }
    // Individual layer flip
    dispatch({ type: "flipVertical", payload: safeFlipV ? 0 : 1, t: 0 } as any)
  }

  const handleOnChange = useCallback(
    (value: number) => {
      if (isDocumentLayer) {
        // Document rotation - rotate all layers by the difference
        const currentRotation = safeRotate
        const rotationDiff = value - currentRotation
        rotateDocument(rotationDiff)
      } else {
        // Individual layer rotation
        dispatch({ type: selectedTool as any, payload: value, t: 0 } as any)
      }
    },
    [dispatch, selectedTool, isDocumentLayer, safeRotate, rotateDocument]
  )

  const Control = useMemo(() => {
    const controlProps = {
      canvasRef,
      drawFnRef,
      operator: "°",
      progress,
      selectedLayer,
      selectedTool,
      toolsValues,
      value: safeRotate, // Use the safe rotation value
      dispatch,
      onChange: handleOnChange,
    }
    switch (selectedTool) {
      case "rotate":
        return (
          <RotationControls
            {...{ ...controlProps, selectedTool: "rotate" as any }}
          />
        )
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
            onClick={handleRotateLeft}
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
            onClick={handleRotateRight}
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
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [jpegQuality, setJpegQuality] = useState(80)
  const [webpQuality, setWebpQuality] = useState(80)

  const downloadImage = useWebGLDownload(canvasRef, drawFnRef)

  const handleOnDownload = useCallback(
    (mimeType: string, quality?: number) => () => {
      downloadImage(mimeType, quality ? quality / 100 : undefined)
    },
    [downloadImage]
  )

  const { history } = useEditorContext()
  const handleOnUndo = useCallback(() => {
    history.undo()
  }, [history])

  const handleOnRedo = useCallback(() => {
    history.redo()
  }, [history])

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
  const { getPlayheadTime } = useEditorContext()
  const t = getPlayheadTime()
  const handleOnChange = useCallback(
    (value: number) => {
      dispatch({ type: selectedTool as any, payload: value, t } as any)
    },
    [dispatch, selectedTool, t]
  )

  const controlProps = {
    progress,
    selectedTool: "scale" as any,
    toolsValues,
    canvasRef,
    drawFnRef,
    selectedLayer,
    value: (() => {
      const v: any = (toolsValues as any).scale
      if (v && typeof v === "object" && Array.isArray(v.kfs)) {
        const { sampleTrack } = require("@/lib/tools/tools") as any
        return Number(sampleTrack(v, t))
      }
      return Number(v)
    })(),
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
  const { getPlayheadTime } = useEditorContext()
  const t = getPlayheadTime()
  const handleOnChange = useCallback(
    (value: number) => {
      dispatch({ type: selectedTool as any, payload: value, t } as any)
    },
    [dispatch, selectedTool, t]
  )

  const controlProps = {
    canvasRef,
    drawFnRef,
    progress,
    selectedLayer,
    selectedTool: "upscale" as any,
    toolsValues,
    value: (() => {
      const v: any = (toolsValues as any).upscale
      if (v && typeof v === "object" && Array.isArray(v.kfs)) {
        const { sampleTrack } = require("@/lib/tools/tools") as any
        return Number(sampleTrack(v, t))
      }
      return Number(v)
    })(),
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
  const handleOnChange = useCallback(
    (value: number) => {
      dispatch({ type: selectedTool as any, payload: value } as any)
    },
    [dispatch, selectedTool]
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
