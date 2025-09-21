"use client"

import { HistoryPanel } from "@/components/history/history-panel"
import { LayersPanel } from "@/components/layers/layer-panel"
import { cn } from "@/lib/utils"
import type {
  ImageEditorToolsActions,
  ImageEditorToolsState,
} from "@/lib/tools/tools-state"

interface ImageEditorPanelsProps extends React.ComponentProps<"div"> {
  notify?: ({ message, title }: { message: string; title?: string }) => void
  allowAddMultipleImages?: boolean
  toolsValues: ImageEditorToolsState
  dispatch: (value: ImageEditorToolsActions | ImageEditorToolsActions[]) => void
}

export function ImageEditorPanels({
  allowAddMultipleImages = false,
  className,
  notify,
  toolsValues,
  dispatch,
  ...props
}: ImageEditorPanelsProps) {
  return (
    <div
      className={cn("flex flex-col w-[320px] space-y-6", className)}
      {...props}
    >
      <LayersPanel
        allowAddMultipleImages={allowAddMultipleImages}
        className='border-b rounded-x-sm'
        toolsValues={toolsValues}
        dispatch={dispatch}
      />

      <div className='border flex flex-col gap-2'>
        <h3 className='text-sm font-medium px-2 mt-4'>History</h3>
        <HistoryPanel notify={notify} />
      </div>
    </div>
  )
}
