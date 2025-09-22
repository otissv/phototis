"use client"

import { Crop, Image, ImageUpscale, Move, RotateCwSquare } from "lucide-react"

import { Button, type ButtonProps } from "@/ui/button"
import { cn } from "@/lib/utils"
import type { EditorLayer } from "@/lib/editor/state"
import { useEditorContext } from "@/lib/editor/context"
import type { SidebarToolsKeys } from "@/lib/tools/tools-state"

export interface ImageEditorSidebarProps
  extends Omit<React.ComponentProps<"ul">, "onChange"> {
  progress?: number
  selectedLayer: EditorLayer
  onChange: (tool: SidebarToolsKeys) => void
}
export function ImageEditorSidebar({
  className,
  progress,
  selectedLayer,
  onChange,
  ...props
}: ImageEditorSidebarProps) {
  const { getSelectedLayerId, activeTool } = useEditorContext()
  const selectedLayerId = getSelectedLayerId()
  const isDocumentLayer = selectedLayerId === "document"

  return (
    <ul className={cn("flex flex-col gap-2 p-2", className)} {...props}>
      <li className={cn({ hidden: !isDocumentLayer })}>
        <SidebarButton
          title='Canvas dimensions'
          toolType='dimensionsCanvas'
          disabled={progress || !isDocumentLayer}
          selectedSidebar={activeTool}
          isDocumentLayer={isDocumentLayer}
          onSidebarClick={onChange}
        >
          <Image />
          Resize
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Resize'
          toolType='dimensions'
          disabled={progress || isDocumentLayer}
          selectedSidebar={activeTool}
          isDocumentLayer={isDocumentLayer}
          className={isDocumentLayer ? "hidden" : ""}
          onSidebarClick={onChange}
        >
          <ImageUpscale />
          Resize
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Rotate Layer'
          toolType='rotate'
          disabled={progress}
          selectedSidebar={activeTool}
          isDocumentLayer={isDocumentLayer}
          onSidebarClick={onChange}
        >
          <RotateCwSquare />
          Rotate
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Crop'
          toolType='crop'
          disabled={progress}
          selectedSidebar={activeTool}
          isDocumentLayer={isDocumentLayer}
          onSidebarClick={onChange}
        >
          <Crop />
          Crop
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Move'
          toolType='move'
          disabled={progress}
          selectedSidebar={activeTool}
          isDocumentLayer={isDocumentLayer}
          onSidebarClick={onChange}
        >
          <Move />
          Move
        </SidebarButton>
      </li>

      <li>
        <SidebarButton
          title='Scale'
          toolType='scale'
          disabled={progress || isDocumentLayer}
          onSidebarClick={onChange}
        >
          <ImageUpscale />
          Scale
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Upscale'
          toolType='upscale'
          disabled={progress || isDocumentLayer}
          onSidebarClick={onChange}
        >
          <ImageUpscale />
          Upscale
        </SidebarButton>
      </li>
    </ul>
  )
}

interface SidebarButtonProps extends Omit<ButtonProps, "selected"> {
  toolType: SidebarToolsKeys
  isDocumentLayer?: boolean
}

function SidebarButton({
  toolType,
  onSidebarClick,
  disabled,
  children,
  title,
  className,
  isDocumentLayer,
}: SidebarButtonProps) {
  const { activeTool } = useEditorContext()

  return (
    <Button
      title={title}
      variant='ghost'
      className={cn(
        "flex flex-col rounded-md text-xs size-12 hover:bg-accent",
        activeTool === toolType && "bg-accent text-accent-foreground",
        activeTool === toolType && isDocumentLayer && "bg-blue-500/50",
        className
      )}
      onClick={() => onSidebarClick(toolType)}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}
