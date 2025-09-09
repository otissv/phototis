"use client"

import { File } from "lucide-react"

import { useEditorContext } from "@/lib/editor/context"
import type { EditorLayer } from "@/lib/editor/state"
import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"

export interface DocumentLayerItemProps extends React.ComponentProps<"div"> {
  isSelected: boolean
  layer: EditorLayer
  setSelectedSidebar: (sidebar: keyof typeof SIDEBAR_TOOLS) => void
}

export function DocumentLayerItem({
  isSelected,
  setSelectedSidebar,
}: DocumentLayerItemProps) {
  const { selectLayer } = useEditorContext()

  return (
    <div className='border-t pt-1'>
      <Button
        variant='ghost'
        size='sm'
        className={cn(
          "cursor-pointer transition-colors w-full text-left text-xs rounded-sm space-y-1 h-10 justify-start pl-1 hover:bg-primary/10",
          isSelected &&
            "border-blue-500/50 bg-blue-500/50 hover:bg-blue-500/50 hover:border-blue-500/50"
        )}
        onClick={() => {
          selectLayer("document")
          setSelectedSidebar("dimensionsCanvas")
        }}
      >
        <div className='flex items-center p-1'>
          <File className='w-4 h-4 mr-[14px]' />
          <span>Document</span>
        </div>
      </Button>
    </div>
  )
}
