"use client"

import {
  Crop,
  Image,
  ImageUpscale,
  RotateCwSquare,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"

import { Button, type ButtonProps } from "@/ui/button"
import { cn } from "@/lib/utils"
import type { TOOL_VALUES } from "@/lib/tools/tools"
import type { EditorLayer } from "@/lib/editor/state"
import {
  SIDEBAR_TOOLS,
  type ImageEditorToolsActions,
} from "@/lib/tools/tools-state"

export interface ImageEditorSidebarProps
  extends Omit<React.ComponentProps<"ul">, "onChange"> {
  progress?: number
  selectedLayer: EditorLayer
  selectedSidebar: keyof typeof SIDEBAR_TOOLS
  onChange: (selected: keyof typeof SIDEBAR_TOOLS) => void
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
}
export function ImageEditorSidebar({
  className,
  onChange,
  onSelectedToolChange,
  progress,
  selectedLayer,
  selectedSidebar,
  ...props
}: ImageEditorSidebarProps) {
  const isDocumentLayer = selectedLayer?.id === "document"

  return (
    <ul className={cn("flex flex-col gap-2 p-2", className)} {...props}>
      <li className={cn({ hidden: !isDocumentLayer })}>
        <SidebarButton
          title='Canvas dimensions'
          footerType='dimensionsCanvas'
          disabled={progress || !isDocumentLayer}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
          isDocumentLayer={isDocumentLayer}
        >
          <Image />
          Resize
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Resize'
          footerType='dimensions'
          disabled={progress || isDocumentLayer}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
          isDocumentLayer={isDocumentLayer}
          className={isDocumentLayer ? "hidden" : ""}
        >
          <ImageUpscale />
          Resize
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Rotate Layer'
          footerType='rotate'
          disabled={progress}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
          isDocumentLayer={isDocumentLayer}
        >
          <RotateCwSquare />
          Rotate
        </SidebarButton>
      </li>

      <li>
        <SidebarButton
          title='Scale'
          footerType='scale'
          disabled={progress}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
          isDocumentLayer={isDocumentLayer}
        >
          <ImageUpscale />
          Scale
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Upscale'
          footerType='upscale'
          disabled={progress}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
          isDocumentLayer={isDocumentLayer}
        >
          <ImageUpscale />
          Upscale
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Crop'
          footerType='crop'
          disabled={progress}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
          isDocumentLayer={isDocumentLayer}
        >
          <Crop />
          Crop
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Filters'
          footerType='effects'
          disabled={progress || isDocumentLayer}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
        >
          <SlidersHorizontal />
          Filters
        </SidebarButton>
      </li>
      <li>
        <SidebarButton
          title='Presets'
          footerType='presets'
          disabled={progress || isDocumentLayer}
          selectedSidebar={selectedSidebar}
          onChange={onChange}
          onSelectedToolChange={onSelectedToolChange}
        >
          <Sparkles />
          Presets
        </SidebarButton>
      </li>
    </ul>
  )
}

interface SidebarButtonProps extends Omit<ButtonProps, "selected"> {
  footerType: keyof typeof SIDEBAR_TOOLS
  selectedSidebar: keyof typeof SIDEBAR_TOOLS
  onChange: (selected: keyof typeof SIDEBAR_TOOLS) => void
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  isDocumentLayer?: boolean
}

function SidebarButton({
  footerType,
  selectedSidebar,
  onChange,
  onSelectedToolChange,
  disabled,
  children,
  title,
  className,
  isDocumentLayer,
}: SidebarButtonProps) {
  return (
    <Button
      title={title}
      variant='ghost'
      className={cn(
        "flex flex-col rounded-md text-xs size-12 hover:bg-blue-500/50",
        selectedSidebar === footerType && "bg-accent text-accent-foreground",
        selectedSidebar === footerType && isDocumentLayer && "bg-blue-500/50",
        className
      )}
      onClick={() => {
        onChange(footerType)
        if (!SIDEBAR_TOOLS.rotate.includes(selectedSidebar)) {
          onSelectedToolChange(footerType as keyof typeof TOOL_VALUES)
        }
      }}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}
