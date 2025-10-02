"use client"

import React from "react"
import { useEditorContext } from "@/lib/editor/context"
import { cn } from "@/lib/utils"

export function TimelineLayersPanel({ className }: { className?: string }) {
  const {
    state,
    toggleVisibility,
    toggleLock,
    setOpacity,
    setBlendMode,
    duplicateLayer,
    removeLayer,
    selectLayer,
    captureChangedTracksAtPlayhead,
  } = useEditorContext()

  const ordered = state.canonical.layers.order
  const byId = state.canonical.layers.byId
  const selectedId = state.canonical.selection.layerIds[0]

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
        <span id={headingId}>Layers</span>
      </div>
      <div className='text-sm select-none'>
        {ordered.map((id) => {
          const layer = byId[id]
          const isSelected = selectedId === id
          return (
            <div
              key={id}
              className={cn(
                "w-full text-left px-2 py-1 grid grid-cols-[100px_1.5rem_1.5rem_1fr_auto] items-center gap-2",
                isSelected
                  ? "bg-blue-500/10"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              )}
              onClick={() => selectLayer(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") selectLayer(id)
              }}
              // container only; interactivity handled by inner buttons
            >
              <button
                className='truncate w-[100px] text-left'
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  selectLayer(id)
                }}
                aria-label={`Select layer ${layer.name}`}
              >
                {layer.name}
              </button>
              {/* Visibility */}
              <button
                className='text-xs opacity-80 hover:opacity-100'
                onClick={(e) => {
                  e.stopPropagation()
                  toggleVisibility(id)
                }}
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
                type='button'
              >
                {layer.visible ? "👁" : "🚫"}
              </button>
              {/* Lock */}
              <button
                className='text-xs opacity-80 hover:opacity-100'
                onClick={(e) => {
                  e.stopPropagation()
                  toggleLock(id)
                }}
                aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
                type='button'
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
              {/* Name + type */}
              <div className='flex items-center gap-2 overflow-hidden'>
                <span className='text-xs opacity-70'>
                  {layer.type === "image"
                    ? "🖼"
                    : layer.type === "adjustment"
                      ? "🎛"
                      : layer.type === "solid"
                        ? "⬛"
                        : layer.type === "document"
                          ? "📄"
                          : "📦"}
                </span>
                <span className='truncate'>{layer.name}</span>
              </div>
              {/* Actions */}
              <div className='flex items-center gap-2'>
                {/* Blend Mode */}
                <select
                  className='border rounded px-1 py-0.5 text-xs bg-transparent'
                  value={layer.blendMode}
                  onChange={(e) => setBlendMode(id, e.target.value as any)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label='Blend mode'
                >
                  {[
                    "normal",
                    "multiply",
                    "screen",
                    "overlay",
                    "darken",
                    "lighten",
                  ].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {/* Opacity */}
                <input
                  type='range'
                  min={0}
                  max={100}
                  step={1}
                  value={layer.opacity}
                  onChange={(e) => setOpacity(id, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  aria-label='Opacity'
                />
                {/* Capture */}
                <button
                  className='text-xs px-1 py-0.5 border rounded'
                  onClick={(e) => {
                    e.stopPropagation()
                    captureChangedTracksAtPlayhead(id)
                  }}
                  aria-label='Capture changed tracks at playhead'
                  type='button'
                >
                  Capture
                </button>
                {/* Duplicate */}
                <button
                  className='text-xs px-1 py-0.5 border rounded'
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicateLayer(id)
                  }}
                  aria-label='Duplicate layer'
                  type='button'
                >
                  Dup
                </button>
                {/* Delete */}
                <button
                  className='text-xs px-1 py-0.5 border rounded'
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLayer(id)
                  }}
                  aria-label='Delete layer'
                  type='button'
                >
                  Del
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
