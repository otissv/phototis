"use client"

import { HistoryPanel } from "@/components/history/history-panel"
import { LayersPanel } from "@/components/layers/layer-panel"
import { cn } from "@/lib/utils"
import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"

interface ImageEditorPanelsProps extends React.ComponentProps<"div"> {
  notify?: ({ message, title }: { message: string; title?: string }) => void
  setSelectedSidebar: (sidebar: keyof typeof SIDEBAR_TOOLS) => void
  allowAddMultipleImages?: boolean
}

export function ImageEditorPanels({
  allowAddMultipleImages = false,
  className,
  notify,
  setSelectedSidebar,
  ...props
}: ImageEditorPanelsProps) {
  return (
    <div
      className={cn("flex flex-col w-[320px] space-y-6", className)}
      {...props}
    >
      <LayersPanel
        allowAddMultipleImages={allowAddMultipleImages}
        setSelectedSidebar={setSelectedSidebar}
        className='border-b rounded-x-sm'
      />

      <div className='border flex flex-col gap-2'>
        <h3 className='text-sm font-medium px-2 mt-4'>History</h3>
        <HistoryPanel notify={notify} />
      </div>
    </div>
  )
}
