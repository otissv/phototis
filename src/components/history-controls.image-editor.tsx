"use client"

import React from "react"
import { Button } from "@/ui/button"
import {
  RotateCcw,
  RotateCw,
  Dot,
  Flag,
  Trash2,
  CornerDownLeft,
} from "lucide-react"
import { useEditorContext } from "@/lib/editor/context"
import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/ui/context-menu"
import { Badge } from "@/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip"
import { timeAgo } from "@/lib/utils/time-ago"

export interface HistoryControlsProps extends React.ComponentProps<"div"> {
  notify?: ({ message, title }: { message: string; title?: string }) => void
  className?: string
}

type HistoryEntry = {
  label: string
  thumbnail?: string | null
  timestamp: number
  scope?: string
}

export function HistoryControls({
  className,
  notify,
  ...props
}: HistoryControlsProps) {
  const { history, state } = useEditorContext()
  // Poll minimal labels from history for UI
  const inspected = history.inspect() as any
  const past = (inspected.past as HistoryEntry[]) || []
  const future = (inspected.future as HistoryEntry[]) || []
  const checkpoints = (inspected.checkpoints as any[]) || []
  const canUndo = history.canUndo()
  const canRedo = history.canRedo()
  const transactionActive = Boolean(inspected.transactionActive)

  const [showThumbnails, setShowThumbnails] = React.useState(true)
  const [dense, setDense] = React.useState(false)
  const [highlightIndex, setHighlightIndex] = React.useState(() => past.length)
  const listRef = React.useRef<HTMLUListElement | null>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerHeight, setContainerHeight] = React.useState(320)

  React.useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const update = () => setContainerHeight(el.clientHeight || 320)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const createCheckpoint = React.useCallback(() => {
    try {
      ;(history as any)?.addCheckpoint?.(new Date().toLocaleTimeString())
    } catch (e) {
      notify?.({ message: "Failed to create checkpoint" })
    }
  }, [history, notify])

  const totalItems = past.length + 1 + future.length
  const itemHeight = dense ? 24 : 32
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 4)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 8
  const endIndex = Math.min(past.length, startIndex + visibleCount)
  const topSpacer = startIndex * itemHeight
  const bottomSpacer = Math.max(0, (past.length - endIndex) * itemHeight)

  const onListScroll = (e: React.UIEvent<HTMLUListElement>) => {
    setScrollTop((e.currentTarget as HTMLUListElement).scrollTop)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key
    if (
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "Enter" ||
      key === " "
    ) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (key === "ArrowUp") {
      setHighlightIndex((i) => Math.max(0, i - 1))
    } else if (key === "ArrowDown") {
      setHighlightIndex((i) => Math.min(totalItems - 1, i + 1))
    } else if (key === "Enter" || key === " ") {
      const idx = highlightIndex
      if (idx < past.length - 1) {
        jumpToPast(idx)
      } else if (idx > past.length) {
        const futureIdx = idx - (past.length + 1)
        if (futureIdx >= 0) jumpToFuture(futureIdx)
      }
    }
  }

  return (
    <div className={cn("w-full space-y-2", className)} {...props}>
      <div className='flex items-center gap-2 border-b px-2 h-12'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => {
                  try {
                    history.undo()
                  } catch {
                    notify?.({ message: "Failed to undo" })
                  }
                }}
                disabled={!canUndo || transactionActive}
                title='Undo (Ctrl/Cmd+Z)'
                aria-label='Undo'
                className='h-8 px-2'
              >
                <RotateCcw className='w-4 h-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl/Cmd+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => {
                  try {
                    history.redo()
                  } catch {
                    notify?.({ message: "Failed to redo" })
                  }
                }}
                disabled={!canRedo || transactionActive}
                title='Redo (Ctrl/Cmd+Shift+Z)'
                aria-label='Redo'
                className='h-8 px-2'
              >
                <RotateCw className='w-4 h-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl/Cmd+Shift+Z)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className='ml-auto flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={createCheckpoint}
            className='h-8 px-2 text-xs'
            title='Create checkpoint'
          >
            <Flag className='w-4 h-4 mr-1' />
            Checkpoint
          </Button>
          <div className='h-6 w-px bg-border' />
          <label className='flex items-center gap-1 text-xs'>
            <input
              type='checkbox'
              className='accent-primary'
              checked={showThumbnails}
              onChange={(e) => setShowThumbnails(e.target.checked)}
            />
            Thumbnails
          </label>
          <label className='flex items-center gap-1 text-xs'>
            <input
              type='checkbox'
              className='accent-primary'
              checked={dense}
              onChange={(e) => setDense(e.target.checked)}
            />
            Dense
          </label>
        </div>
      </div>

      <section
        className='max-h-[40vh] overflow-auto space-y-1 pr-1 outline-none'
        aria-label='History timeline'
        ref={listRef as unknown as React.RefObject<HTMLElement>}
        onScroll={onListScroll as any}
        onKeyDown={onKeyDown as any}
      >
        {/* Checkpoints */}
        {checkpoints.length > 0 &&
          checkpoints.map((cp) => (
            <div key={cp.id} className='flex items-center gap-2 p-2 border-b'>
              <Badge
                variant='secondary'
                className='truncate max-w-[240px] rounded-sm'
              >
                <Flag className='w-3 h-3 mr-1' /> {cp.name}
              </Badge>
              <Button
                variant='ghost'
                size='xs'
                className='h-6 px-2 text-xs'
                onClick={() => (history as any)?.jumpToCheckpoint?.(cp.id)}
                title='Jump to checkpoint'
              >
                <CornerDownLeft className='w-3 h-3 mr-1' /> Jump
              </Button>
            </div>
          ))}

        <ul className='space-y-1 p-2'>
          {/* Past entries: render oldest to newest; newest is the current state marker */}
          {past.slice(startIndex, endIndex).map((entry, relIdx) => {
            const idx = startIndex + relIdx
            const isCurrent = idx === past.length - 1
            const label = entry.label || "Step"
            const thumb = showThumbnails ? entry.thumbnail : null

            return (
              <li
                key={`past-${entry.label}-${idx}`}
                className={cn(
                  "list-none rounded-sm",
                  past.length - 1 === idx ? "ring-1 ring-primary" : ""
                )}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <HistoryItem
                      label={label}
                      thumbnail={entry.thumbnail}
                      timestamp={entry.timestamp}
                      scope={entry.scope}
                      isCurrent={isCurrent}
                      dense={dense}
                      showThumbnails={showThumbnails}
                      disabled={isCurrent || transactionActive}
                      onClick={() =>
                        !isCurrent && !transactionActive && jumpToPast(idx)
                      }
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => !isCurrent && jumpToPast(idx)}
                    >
                      Go to this state
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => createCheckpoint()}>
                      Create checkpoint here
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      disabled={transactionActive}
                      onClick={() => {
                        if (transactionActive) return
                        if (confirm("Delete steps after this?")) {
                          const steps = Math.max(0, past.length - 1 - idx)
                          for (let i = 0; i < steps; i += 1) history.undo()
                        }
                      }}
                    >
                      <Trash2 className='w-3 h-3 mr-2' /> Delete steps after
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={transactionActive}
                      onClick={() => {
                        if (transactionActive) return
                        if (confirm("Delete steps before this?")) {
                          ;(history as any)?.deleteStepsBeforeIndex?.(idx)
                        }
                      }}
                    >
                      <Trash2 className='w-3 h-3 mr-2' /> Delete steps before
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        try {
                          const doc = (history as any)?.exportDocumentAtIndex?.(
                            idx
                          )
                          const blob = new Blob(
                            [JSON.stringify(doc, null, 2)],
                            {
                              type: "application/json",
                            }
                          )
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url
                          a.download = `document-at-step-${idx + 1}.json`
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          notify?.({ message: "Failed to duplicate document" })
                        }
                      }}
                    >
                      Duplicate document from here
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </li>
            )
          })}

          {/* Current marker */}
          <li className='list-none rounded-sm'>
            <div className='flex items-center gap-2 text-xs px-2 py-1 rounded-sm bg-primary/10 text-primary'>
              <Dot className='w-4 h-4' />
              <span className='truncate'>Current</span>
              {checkpoints.some((cp) => cp.atIndex === past.length) ? (
                <Badge
                  variant='secondary'
                  className='text-[10px] px-1 rounded-sm'
                >
                  Checkpoint
                </Badge>
              ) : null}
            </div>
          </li>

          {/* Future entries: render next redo first */}
          {future.map((entry, idx) => {
            return (
              <li
                key={`future-${entry.label}-${idx}`}
                className='list-none rounded-sm'
              >
                <HistoryItem
                  dense={dense}
                  disabled={!history.canRedo() || transactionActive}
                  isCurrent={false}
                  label={entry.label}
                  scope={entry.scope}
                  showThumbnails={showThumbnails}
                  thumbnail={entry.thumbnail}
                  timestamp={entry.timestamp}
                  title='Click to redo'
                  onClick={() => {
                    try {
                      jumpToFuture(idx)
                    } catch {
                      notify?.({ message: "Failed to redo" })
                    }
                  }}
                />
              </li>
            )
          })}
          <li className='h-0' style={{ height: `${bottomSpacer}px` }} />
        </ul>
      </section>

      <div className='flex items-center justify-between text-[11px] text-muted-foreground p-2 border-t'>
        <div>
          {inspected.counts?.past ?? past.length} steps,{" "}
          {inspected.counts?.future ?? future.length} redo
        </div>
        <div>
          ~
          {Math.max(
            1,
            Math.round((state.canonical.layers.order.length * 24) / 10)
          ) / 10}{" "}
          MB
        </div>
      </div>
    </div>
  )
}

function HistoryItem({
  dense,
  disabled,
  isCurrent,
  label,
  scope,
  showThumbnails,
  thumbnail,
  timestamp,
  title,
  onClick,
}: {
  dense: boolean
  disabled: boolean
  isCurrent: boolean
  label: string
  scope: HistoryEntry["scope"]
  showThumbnails: boolean
  thumbnail: HistoryEntry["thumbnail"]
  timestamp: HistoryEntry["timestamp"]
  title: string
  onClick: () => void
}) {
  const [time, setTime] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (timestamp) {
      timeAgo(new Date(timestamp), true, setTime)
    }
  }, [timestamp])

  return (
    <button
      type='button'
      className={cn(
        "w-full text-left flex items-center gap-2 px-2 rounded-sm",
        dense ? "text-[11px] py-1" : "text-xs py-1.5",
        "bg-muted/30 hover:bg-muted",
        isCurrent ? "cursor-default" : "cursor-pointer"
      )}
      aria-current={isCurrent ? "step" : undefined}
      aria-disabled={disabled}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Dot className='w-4 h-4 text-muted-foreground' />
      {scope ? (
        <Badge variant='outline' className='text-[10px] px-1 rounded-sm'>
          {scope}
        </Badge>
      ) : null}

      {showThumbnails && thumbnail ? (
        <img
          src={thumbnail}
          alt=''
          width={24}
          height={24}
          className='rounded border object-cover'
          aria-hidden='true'
        />
      ) : null}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild className='w-full h-8 flex items-center'>
            <div className='flex items-center gap-2'>
              <span className='truncate'>{label || "Step"}</span>
              <span className='text-xs text-muted-foreground'>{time}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{time}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </button>
  )
}
