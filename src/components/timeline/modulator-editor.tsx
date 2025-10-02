"use client"

import React from "react"
import type { Track } from "@/lib/animation/model"
// UI persists param objects; sampling layer will construct functions from ids/params.

type Props = {
  track: Track<number>
  onChange: (next: Track<number>) => void
}

type ModKind = "lfo" | "noise" | "randomStep"

export function ModulatorEditor({ track, onChange }: Props) {
  const [mods, setMods] = React.useState(() => track.modulators ?? [])

  // Factory helpers are intentionally simple; UI persists params only.

  const addMod = (kind: ModKind) => {
    const init =
      kind === "lfo"
        ? {
            id: "lfo",
            params: {
              type: "sine",
              amplitude: 1,
              frequency: 1,
              phase: 0,
              bias: 0,
            },
          }
        : kind === "noise"
          ? { id: "noise", params: { amplitude: 1, frequency: 1, seed: 0 } }
          : { id: "randomStep", params: { amplitude: 1, hold: 0.25, seed: 0 } }
    const next = [...mods, init]
    setMods(next)
    onChange({ ...track, modulators: next })
  }

  const updateMod = (index: number, params: Record<string, unknown>) => {
    const next = mods.map((m, i) =>
      i === index ? { ...m, params: { ...m.params, ...params } } : m
    )
    setMods(next)
    onChange({ ...track, modulators: next })
  }

  const removeMod = (index: number) => {
    const next = mods.filter((_, i) => i !== index)
    setMods(next)
    onChange({ ...track, modulators: next })
  }

  return (
    <div className='space-y-2'>
      <div className='flex gap-2'>
        <button
          type='button'
          className='px-2 py-1 text-xs border rounded'
          onClick={() => addMod("lfo")}
        >
          Add LFO
        </button>
        <button
          type='button'
          className='px-2 py-1 text-xs border rounded'
          onClick={() => addMod("noise")}
        >
          Add Noise
        </button>
        <button
          type='button'
          className='px-2 py-1 text-xs border rounded'
          onClick={() => addMod("randomStep")}
        >
          Add Random Step
        </button>
      </div>

      <ul className='space-y-2'>
        {(mods || []).map((m, idx) => (
          <li key={`${m.id}-${idx}`} className='p-2 border rounded space-y-2'>
            <div className='flex items-center justify-between'>
              <strong className='text-xs'>{m.id}</strong>
              <button
                type='button'
                className='px-2 py-1 text-xs border rounded'
                onClick={() => removeMod(idx)}
              >
                Remove
              </button>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              {Object.entries(m.params || {}).map(([k, v]) => (
                <label key={k} className='text-xs flex items-center gap-2'>
                  <span className='w-24 truncate'>{k}</span>
                  <input
                    className='border px-1 py-0.5 text-xs w-full'
                    type='number'
                    value={Number(v) || 0}
                    onChange={(e) =>
                      updateMod(idx, { [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
