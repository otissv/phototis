"use client"

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react"
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
import type { HistoryGraph } from "@/lib/history/types"
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
// no local debug needed
import type { Command } from "@/lib/commands/command"

// const { isDebug } = config()

export interface HistoryPanelProps extends React.ComponentProps<"div"> {
  notify?: ({ message, title }: { message: string; title?: string }) => void
  className?: string
}

type HistoryEntry = {
  label: string
  thumbnail?: string | null
  timestamp: number
  scope?: string
  commands?: Command[]
}

export function HistoryPanel({
  className,
  notify,
  ...props
}: HistoryPanelProps) {
  const { history, state } = useEditorContext()
  const graph: HistoryGraph = (history as any).getGraph?.() || {
    commits: {},
    branches: {},
    children: {},
    head: { type: "detached", at: "" },
    protected: { commits: new Set(), branches: new Set() },
  }
  // Expose graph globally for hover previews (consumed by canvas)
  try {
    ;(window as any).$graph = graph
  } catch {}
  // Poll minimal labels from history for UI
  const inspected = history.inspect() as any
  const past = (inspected.past as HistoryEntry[]) || []
  const future = (inspected.future as HistoryEntry[]) || []
  const checkpoints = (inspected.checkpoints as any[]) || []
  const canUndo = history.canUndo()
  const canRedo = history.canRedo()
  const transactionActive = Boolean(inspected.transactionActive)

  const [showThumbnails, setShowThumbnails] = useState(true)
  const [dense, setDense] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(() => past.length)
  const listRef = useRef<HTMLUListElement | null>(null)
  const [scrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(320)
  const [squashStartId, setSquashStartId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const update = () => setContainerHeight(el.clientHeight || 320)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keyboard is handled in parent; this UI is strictly visual and clickable

  const jumpToPast = useCallback(
    (targetIndex: number) => {
      const steps = Math.max(0, past.length - 1 - targetIndex)
      for (let i = 0; i < steps; i += 1) history.undo()
    },
    [past.length, history]
  )

  const jumpToFuture = useCallback(
    (targetIndex: number) => {
      const steps = targetIndex + 1 // future[0] is next redo
      for (let i = 0; i < steps; i += 1) history.redo()
    },
    [history]
  )

  const createCheckpoint = useCallback(() => {
    try {
      ;(history as any)?.addCheckpoint?.(new Date().toLocaleTimeString())
    } catch {
      notify?.({ message: "Failed to create checkpoint" })
    }
  }, [history, notify])

  const totalItems = past.length + 1 + future.length
  const itemHeight = dense ? 24 : 32
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 4)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 8
  const endIndex = Math.min(past.length, startIndex + visibleCount)

  // const onListScroll = (e: uIEvent<HTMLUListElement>) => {
  //   setScrollTop((e.currentTarget as HTMLUListElement).scrollTop)
  // }

  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    const key = ev.key
    if (
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "Enter" ||
      key === " "
    ) {
      ev.preventDefault()
      ev.stopPropagation()
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
    <div className={cn("w-full space-y-2 ", className)} {...props}>
      {/* DAG Graph View */}
      <GraphView graph={graph} />
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
          {/* Squash controls */}
          {squashStartId ? (
            <>
              <Badge variant='secondary' className='rounded-sm text-[10px]'>
                Squash from {squashStartId.slice(0, 7)}
              </Badge>
              <Button
                size='sm'
                variant='outline'
                className='h-8 px-2 text-xs'
                onClick={() => setSquashStartId(null)}
              >
                Cancel
              </Button>
            </>
          ) : null}
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
        className='space-y-1 pr-1 max-h-[320px] overflow-y-auto'
        aria-label='History timeline'
        ref={listRef as unknown as React.RefObject<HTMLElement>}
        // onScroll={onListScroll as any}
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
            // const thumb = showThumbnails ? entry.thumbnail : null

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
                      timestamp={entry.timestamp}
                      scope={entry.scope}
                      isCurrent={isCurrent}
                      dense={dense}
                      disabled={isCurrent || transactionActive}
                      onClick={() =>
                        !isCurrent && !transactionActive && jumpToPast(idx)
                      }
                      title='Click to go to this state'
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
                    <ContextMenuItem
                      onClick={() =>
                        setSquashStartId((history as any).head?.()?.at || null)
                      }
                    >
                      Squash start here
                    </ContextMenuItem>
                    {squashStartId ? (
                      <ContextMenuItem
                        onClick={() => {
                          try {
                            const start = squashStartId
                            const target = (history as any).head?.()?.at
                            if (!start || !target)
                              return // Build single-lineage range using history API
                            ;(history as any)
                              .replayDelta(start, target)
                              .then(() =>
                                (history as any)
                                  .squash?.([start, target])
                                  .finally(() => setSquashStartId(null))
                              )
                          } catch {}
                        }}
                      >
                        Squash end here
                      </ContextMenuItem>
                    ) : null}
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
          {/* <li className='h-0' style={{ height: `${bottomSpacer}px` }} /> */}
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
  timestamp,
  title,
  onClick,
}: {
  dense: boolean
  disabled: boolean
  isCurrent: boolean
  label: string
  scope: HistoryEntry["scope"]
  timestamp: HistoryEntry["timestamp"]
  title: string
  onClick: () => void
}) {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
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

      {/* Thumbnail preview intentionally disabled for a11y lint; retained via DAG hover */}

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

function GraphView({ graph }: { graph: HistoryGraph }) {
  const { history } = useEditorContext()
  // const [hovered, setHovered] = useState<string | null>(null)
  const entries = Object.values(graph.commits).sort(
    (a, b) => a.timestamp - b.timestamp
  )
  // Lane assignment: greedy based on parent occupancy
  const laneOf = new Map<string, number>()
  for (const c of entries) {
    const parent = c.parentIds[0]
    if (parent && laneOf.has(parent)) {
      laneOf.set(c.id, laneOf.get(parent) as number)
    } else {
      // assign lowest free lane
      let lane = 0
      const used = new Set(laneOf.values())
      while (used.has(lane)) lane += 1
      laneOf.set(c.id, lane)
    }
  }
  // const maxLane = Math.max(0, ...Array.from(laneOf.values()))
  return (
    <div className='px-2 py-2 border-b'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-xs font-medium'>Branches</span>
        <div className='flex items-center gap-2'>
          <BranchDropdown />
        </div>
      </div>
      <div className='relative'>
        <ul className='space-y-1'>
          {entries.map((c) => {
            const lane = laneOf.get(c.id) || 0
            return (
              <li key={c.id} className='relative'>
                <div
                  className='flex items-center gap-2 group'
                  style={{ marginLeft: `${lane * 16}px` }}
                  onMouseEnter={() => {
                    try {
                      const evt = new CustomEvent("phototis:history-hover", {
                        detail: { commitId: c.id },
                      })
                      window.dispatchEvent(evt)
                    } catch {}
                  }}
                  onMouseLeave={() => {
                    try {
                      const evt = new CustomEvent("phototis:history-hover-end")
                      window.dispatchEvent(evt)
                    } catch {}
                  }}
                >
                  <div className='w-2 h-2 rounded-full bg-primary' />
                  <button
                    type='button'
                    className='text-xs hover:underline'
                    title={new Date(c.timestamp).toLocaleString()}
                    onClick={() => history.checkout({ commitId: c.id })}
                  >
                    {c.label}
                  </button>
                  <span className='text-[10px] text-muted-foreground'>
                    {c.id.slice(0, 7)}
                  </span>
                  {/* Actions */}
                  <div className='ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1'>
                    <button
                      type='button'
                      className='text-[10px] underline'
                      onClick={() =>
                        history.createBranch(`branch-${c.id.slice(0, 6)}`, c.id)
                      }
                      title='New branch here'
                    >
                      branch
                    </button>
                    <button
                      type='button'
                      className='text-[10px] underline'
                      onClick={() => void history.cherryPick(c.id)}
                      title='Cherry-pick'
                    >
                      pick
                    </button>
                    <button
                      type='button'
                      className='text-[10px] underline'
                      onClick={() => void history.revert(c.id)}
                      title='Revert'
                    >
                      revert
                    </button>
                  </div>
                  {c.thumbnail ? (
                    <div
                      role='img'
                      aria-label='History thumbnail'
                      className='ml-2 w-16 h-16 rounded border bg-center bg-cover'
                      style={{ backgroundImage: `url(${c.thumbnail})` }}
                    />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function BranchDropdown() {
  const { history } = useEditorContext()
  const branches = history.listBranches()
  const head = history.head()
  const current = head.type === "branch" ? head.name || "detached" : "detached"
  return (
    <div className='flex items-center gap-2'>
      <span className='text-xs'>Branch</span>
      <select
        className='text-xs border rounded-sm px-1 py-0.5 bg-background'
        value={current || "detached"}
        onChange={(ev) => {
          const name = ev.target.value
          if (name === "detached") return
          void history.checkout({ branch: name })
        }}
      >
        {branches.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
          </option>
        ))}
        {current !== "detached" ? null : (
          <option value='detached'>detached</option>
        )}
      </select>
      <button
        type='button'
        className='text-[10px] underline'
        onClick={() => {
          const name = prompt(
            "New branch name",
            `branch-${Date.now().toString(36)}`
          )
          if (name) history.createBranch(name)
        }}
      >
        new
      </button>
    </div>
  )
}
