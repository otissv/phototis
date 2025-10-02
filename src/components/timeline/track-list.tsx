"use client"

import React from "react"
import { useEditorContext } from "@/lib/editor/context"
import { cn } from "@/lib/utils"

export function TrackList({ className }: { className?: string }) {
  const { state } = useEditorContext()

  // Collect tracks from selected layer first; fallback to document
  const selectedId = state.canonical.selection.layerIds[0]
  const selectedLayer = selectedId
    ? state.canonical.layers.byId[selectedId]
    : null
  const layerForTracks =
    selectedLayer &&
    (selectedLayer.type === "image" || selectedLayer.type === "document")
      ? (selectedLayer as any)
      : (state.canonical.layers.byId["document"] as any)

  const tools = (layerForTracks?.filters || {}) as Record<string, unknown>

  const rows = React.useMemo(() => {
    const entries: Array<{ key: string; count: number }> = []
    for (const [key, val] of Object.entries(tools)) {
      if (key === "history" || key === "historyPosition" || key === "solid")
        continue
      if (
        val &&
        typeof val === "object" &&
        Array.isArray((val as any).keyframes)
      ) {
        entries.push({ key, count: (val as any).keyframes.length })
      }
    }
    entries.sort((a, b) => a.key.localeCompare(b.key))
    return entries
  }, [tools])

  const headingId = React.useId()
  return (
    <section
      className={cn(
        "border rounded-sm bg-white/60 dark:bg-black/30",
        className
      )}
      aria-labelledby={headingId}
    >
      <div className='px-2 py-1 text-xs font-medium uppercase tracking-wide opacity-70'>
        <span id={headingId}>Tracks</span>
      </div>
      <ul className='max-h-48 overflow-auto text-sm'>
        {rows.map((r) => (
          <li
            key={r.key}
            className='px-2 py-1 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5'
          >
            <span className='truncate'>{r.key}</span>
            <span className='opacity-60 text-xs'>{r.count}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className='px-2 py-2 text-xs opacity-60'>
            No keyframed parameters
          </li>
        )}
      </ul>
    </section>
  )
}
