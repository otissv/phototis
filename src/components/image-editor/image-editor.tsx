"use client"

import React from "react"
import { PlusIcon, MinusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SIDEBAR_TOOLS, TOOL_VALUES } from "@/constants"
import { ImageEditorCanvas } from "@/components/image-editor/canvas-image-editor"
import { ImageEditorSidebar } from "@/components/image-editor/sidebar-image-editor"
import { getEditorTools } from "@/components/image-editor/tools.image-editor"
import {
  imageEditorToolsReducer,
  initialState,
  type ImageEditorToolsActions,
} from "@/components/image-editor/state.image-editor"

export interface ImageEditorProps extends React.ComponentProps<"div"> {
  image: File
}

export function ImageEditor({ image, ...props }: ImageEditorProps) {
  const [selectedSidebar, setSelectedSidebar] =
    React.useState<keyof typeof SIDEBAR_TOOLS>("transform")
  const [selectedTool, setSelectedTool] =
    React.useState<keyof typeof TOOL_VALUES>("rotate")
  const [progress, setProgress] = React.useState(0)

  const [toolsValues, dispatch] = React.useReducer(
    imageEditorToolsReducer,
    initialState
  )

  const value = React.useMemo(() => {
    switch (selectedTool) {
      case "rotate":
        return toolsValues.rotate
      case "scale":
        return toolsValues.scale
      case "brightness":
        return toolsValues.brightness
      case "contrast":
        return toolsValues.contrast
      case "hue":
        return toolsValues.hue
      case "saturation":
        return toolsValues.saturation
      case "exposure":
        return toolsValues.exposure
      case "temperature":
        return toolsValues.temperature
      case "gamma":
        return toolsValues.gamma
      case "vintage":
        return toolsValues.vintage
      case "blur":
        return toolsValues.blur
      case "invert":
        return toolsValues.invert
      case "sepia":
        return toolsValues.sepia
      case "grayscale":
        return toolsValues.grayscale
      case "sharpen":
        return toolsValues.sharpen
      case "tint":
        return toolsValues.tint
      case "vibrance":
        return toolsValues.vibrance
      case "noise":
        return toolsValues.noise
      case "grain":
        return toolsValues.grain
      default:
        return 0
    }
  }, [
    selectedTool,
    toolsValues.rotate,
    toolsValues.scale,
    toolsValues.brightness,
    toolsValues.contrast,
    toolsValues.hue,
    toolsValues.saturation,
    toolsValues.exposure,
    toolsValues.temperature,
    toolsValues.gamma,
    toolsValues.vintage,
    toolsValues.blur,
    toolsValues.invert,
    toolsValues.sepia,
    toolsValues.grayscale,
    toolsValues.sharpen,
    toolsValues.tint,
    toolsValues.vibrance,
    toolsValues.noise,
    toolsValues.grain,
  ])

  const handleSelectedToolChange = (tool: keyof typeof TOOL_VALUES) => {
    setSelectedTool(tool)
  }

  const handleSelectedSidebarChange = (sidebar: keyof typeof SIDEBAR_TOOLS) => {
    setSelectedSidebar(sidebar)
  }

  const { header: Header, footer: ImageEditorFooter } = React.useMemo(
    () => getEditorTools(selectedSidebar),
    [selectedSidebar]
  )

  const handleOnProgress = (progress: number) => {
    setProgress(progress)
  }

  return (
    <div
      {...props}
      className='grid grid-cols-[80px_1fr] grid-rows-[auto_1fr_auto] gap-x4 justify-center'
    >
      <ImageEditorSidebar
        selected={selectedSidebar}
        onSelectedToolChange={handleSelectedToolChange}
        onChange={handleSelectedSidebarChange}
        className='col-start-1 row-start-1 row-end-3'
        dispatch={dispatch}
        progress={progress}
      />

      <div className='col-start-2 row-start-1 w-full flex flex-col'>
        <div className='flex flex-col items-center'>
          <Header
            dispatch={dispatch}
            selectedTool={selectedTool}
            onSelectedToolChange={handleSelectedToolChange}
            toolsValues={toolsValues}
            progress={progress}
          />
        </div>
      </div>

      <div className='col-start-2 row-start-2 flex flex-col items-center overflow-hidden'>
        <div className='flex justify-center items-center w-full overflow-hidden h-[calc(100vh-300px)]'>
          <div className='relative w-full h-full overflow-auto'>
            <div className='absolute inset-0 flex items-center justify-center'>
              <ImageEditorCanvas
                image={image}
                toolsValues={toolsValues}
                onProgress={handleOnProgress}
              />
            </div>
          </div>
        </div>
      </div>

      <ImageEditorFooter
        image={image}
        dispatch={dispatch}
        selectedTool={selectedTool}
        value={value}
        onSelectedToolChange={handleSelectedToolChange}
        className='col-start-2 row-start-3 mx-auto'
        toolsValues={toolsValues}
        onProgress={handleOnProgress}
        progress={progress}
      />

      <ZoomControls
        className='col-start-1 row-start-3'
        dispatch={dispatch}
        value={toolsValues.zoom}
      />
    </div>
  )
}

function ZoomControls({
  className,
  dispatch,
  value,
}: {
  className: string
  dispatch: React.Dispatch<ImageEditorToolsActions>
  value: number
}) {
  const handleZoom = (operator: "plus" | "minus") => () => {
    const payload = operator === "plus" ? value + 25 : value - 25
    if (payload < 13) {
      return
    }

    dispatch({ type: "zoom", payload })
  }

  return (
    <div className={cn("flex items-center ", className)}>
      <Button
        variant='outline'
        onClick={handleZoom("minus")}
        className='text-xs rounded-l-full p-3'
      >
        <MinusIcon className='w-3 h-3' />
      </Button>{" "}
      <div className='text-xs px-3 border-y h-10 flex items-center'>
        {value}%
      </div>{" "}
      <Button
        variant='outline'
        onClick={handleZoom("plus")}
        className='text-xs rounded-r-full p-3'
      >
        <PlusIcon className='w-3 h-3' />
      </Button>
    </div>
  )
}
