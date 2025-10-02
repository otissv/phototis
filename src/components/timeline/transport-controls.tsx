"use client"

import { useCallback } from "react"
import { useEditorContext } from "@/lib/editor/context"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"

export function TransportControls({ className }: { className?: string }) {
  const { state, play, pause, stop, setLoop } = useEditorContext()
  const playing = state.canonical.transport.playing
  const loop = state.canonical.transport.loop

  const onPlayPause = useCallback(() => {
    if (playing) pause()
    else play()
  }, [playing, play, pause])

  const onStop = useCallback(() => {
    stop()
  }, [stop])

  const onToggleLoop = useCallback(() => {
    setLoop(!loop)
  }, [loop, setLoop])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        size='sm'
        variant='outline'
        onClick={onPlayPause}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "Pause" : "Play"}
      </Button>
      <Button size='sm' variant='outline' onClick={onStop} aria-label='Stop'>
        Stop
      </Button>
      <Button
        size='sm'
        variant={loop ? "default" : "outline"}
        onClick={onToggleLoop}
        aria-pressed={loop}
        aria-label='Loop'
      >
        Loop
      </Button>
    </div>
  )
}
