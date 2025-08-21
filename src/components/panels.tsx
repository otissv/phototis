"use client"

import { Layers, History, Compass } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { HistoryControls } from "./history-controls.image-editor"
import { LayerSystem } from "@/components/layer-system"
import { cn } from "@/lib/utils"

interface ImageEditorPanelsProps extends React.ComponentProps<typeof Tabs> {
  notify?: ({ message, title }: { message: string; title?: string }) => void
}

export function ImageEditorPanels({
  notify,
  className,
  ...props
}: ImageEditorPanelsProps) {
  return (
    <Tabs
      className={cn("lg:row-span-3 w-full rounded-sm", className)}
      defaultValue='layers'
      {...props}
    >
      <TabsList className='rounded-b-none w-full justify-between'>
        <TabsTrigger value='layers' className='flex gap-2 flex-1 rounded-sm'>
          <Layers className='w-4 h-4' /> Layers
        </TabsTrigger>
        <TabsTrigger value='history' className='flex gap-2 flex-1 rounded-sm'>
          <History className='w-4 h-4' /> History
        </TabsTrigger>
        <TabsTrigger value='navigator' className='flex gap-2 flex-1 rounded-sm'>
          <Compass className='w-4 h-4' />
          Navigator
        </TabsTrigger>
      </TabsList>

      <div className='border rounded-x-sm rounded-b-sm w-[320px]'>
        <TabsContent value='history'>
          <HistoryControls notify={notify} />
        </TabsContent>
        <TabsContent value='layers'>
          <LayerSystem />
        </TabsContent>
        <TabsContent value='navigator'>navigator</TabsContent>
      </div>
    </Tabs>
  )
}
