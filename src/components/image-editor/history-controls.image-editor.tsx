"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw, RotateCw, Dot } from "lucide-react"
import { useEditorContext } from "@/lib/editor/context"
import { cn } from "@/lib/utils"

export function HistoryControls({ className }: { className?: string }) {
  const { history } = useEditorContext()
  // Trigger re-render when history changes via a simple tick from context-accessed labels
  // Rerenders are driven by canonical state changes via context; no explicit subscription needed

  // Poll minimal labels from history for UI; safe and cheap
  const { past, future } = history.inspect()
  const canUndo = history.canUndo()
  const canRedo = history.canRedo()

  // Keyboard is handled in parent; this UI is strictly visual and clickable

  const jumpToPast = React.useCallback(
    (targetIndex: number) => {
      const steps = Math.max(0, past.length - 1 - targetIndex)
      for (let i = 0; i < steps; i += 1) history.undo()
    },
    [past.length, history]
  )

  const jumpToFuture = React.useCallback(
    (targetIndex: number) => {
      const steps = targetIndex + 1 // future[0] is next redo
      for (let i = 0; i < steps; i += 1) history.redo()
    },
    [history]
  )

  return (
    <div className={cn("w-full p-2 space-y-2", className)}>
      <div className='flex items-center gap-2 border-b pb-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => history.undo()}
          disabled={!canUndo}
          title='Undo (Ctrl/Cmd+Z)'
          className='h-8 px-2'
        >
          <RotateCcw className='w-4 h-4' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => history.redo()}
          disabled={!canRedo}
          title='Redo (Ctrl/Cmd+Shift+Z)'
          className='h-8 px-2'
        >
          <RotateCw className='w-4 h-4' />
        </Button>
      </div>

      <div className='text-xs text-muted-foreground'>Timeline</div>

      <div className='max-h-[40vh] overflow-auto space-y-1 pr-1'>
        {/* Past entries: render oldest to newest; newest is the current state marker */}
        {past.map((label, idx) => (
          <button
            key={`past-${idx}-${label}`}
            type='button'
            className={cn(
              "w-full text-left flex items-center gap-2 text-xs px-2 py-1 rounded-sm",
              "bg-muted/30 hover:bg-muted",
              idx === past.length - 1 ? "cursor-default" : "cursor-pointer"
            )}
            aria-current={idx === past.length - 1 ? "step" : undefined}
            onClick={() => idx !== past.length - 1 && jumpToPast(idx)}
            disabled={idx === past.length - 1}
          >
            <Dot className='w-4 h-4 text-muted-foreground' />
            <span className='truncate'>{label || "Step"}</span>
          </button>
        ))}

        {/* Current marker */}
        <div className='flex items-center gap-2 text-xs px-2 py-1 rounded-sm bg-primary/10 text-primary'>
          <Dot className='w-4 h-4' />
          <span className='truncate'>Current</span>
        </div>

        {/* Future entries: render next redo first */}
        {future.map((label, idx) => (
          <button
            key={`future-${idx}-${label}`}
            type='button'
            className={cn(
              "w-full text-left flex items-center gap-2 text-xs px-2 py-1 rounded-sm",
              "hover:bg-muted"
            )}
            onClick={() => jumpToFuture(idx)}
            disabled={!history.canRedo()}
            title='Click to redo'
          >
            <Dot className='w-4 h-4 text-muted-foreground' />
            <span className='truncate text-muted-foreground'>
              {label || "Step"}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
