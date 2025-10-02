"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { useEditorContext } from "@/lib/editor/context"
import { PlayheadControl } from "@/components/timeline/playhead-control"
import { TransportControls } from "@/components/timeline/transport-controls"
import { TimeDisplay } from "@/components/timeline/time-display"
import { TimelineLayersPanel } from "./timeline-layers-panel"
import { KeyframeEditor } from "./keyframe-editor"

export function TimelinePanel({ className }: { className?: string }) {
  const headingId = React.useId()
  const { state } = useEditorContext()
  const duration = state.canonical.transport.duration ?? 10
  const fps = state.canonical.transport.fps ?? 30
  const playheadTime = state.canonical.playheadTime

  // Avoid re-rendering the heavy keyframe area when unrelated state changes
  // Select only the specific primitives we need.

  return (
    <section
      className={cn(
        "w-full select-none border rounded-sm bg-white/70 dark:bg-black/40 backdrop-blur-sm",
        "px-2 py-2 flex flex-col gap-2",
        className
      )}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className='sr-only'>
        Timeline
      </h2>
      <div className='flex items-center gap-2 flex-wrap'>
        <TransportControls />
        <div className='ml-auto'>
          <TimeDisplay
            currentTime={playheadTime}
            duration={duration}
            fps={fps}
          />
        </div>
      </div>

      <PlayheadControl duration={duration} currentTime={playheadTime} />

      <div className='flex gap-2 flex-col md:flex-row'>
        <TimelineLayersPanel className='md:w-60 w-full shrink-0 md:resize-x overflow-auto' />
        <KeyframeEditor className='flex-1' duration={duration} />
      </div>
    </section>
  )
}
