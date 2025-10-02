"use client"

import React from "react"
import type { Track } from "@/lib/animation/model"
import { expressions } from "@/lib/animation/plugins/expressions"

type Props = {
  track: Track<number>
  onChange: (next: Track<number>) => void
}

export function ExpressionEditor({ track, onChange }: Props) {
  const [exprId, setExprId] = React.useState<string | null>(
    track.expression?.id ?? null
  )
  const [params, setParams] = React.useState<Record<string, number>>(
    (track.expression?.params as Record<string, number>) || {}
  )

  const onSelect = (id: string | null) => {
    setExprId(id)
    const spec = id ? expressions[id] : null
    const nextParams = spec
      ? Object.fromEntries(
          Object.entries(spec.params).map(([k, v]) => [k, v.defaultValue])
        )
      : {}
    setParams(nextParams)
    onChange({ ...track, expression: id ? { id, params: nextParams } : null })
  }

  const updateParam = (k: string, v: number) => {
    const nextParams = { ...params, [k]: v }
    setParams(nextParams)
    if (exprId)
      onChange({ ...track, expression: { id: exprId, params: nextParams } })
  }

  return (
    <div className='space-y-2'>
      <label className='text-xs flex items-center gap-2'>
        <span className='w-24'>Expression</span>
        <select
          className='border px-1 py-0.5 text-xs'
          value={exprId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value=''>None</option>
          {Object.values(expressions).map((spec) => (
            <option key={spec.id} value={spec.id}>
              {spec.label}
            </option>
          ))}
        </select>
      </label>

      {exprId ? (
        <div className='grid grid-cols-2 gap-2'>
          {Object.entries(expressions[exprId].params).map(([k, spec]) => (
            <label key={k} className='text-xs flex items-center gap-2'>
              <span className='w-24 truncate'>{spec.label}</span>
              <input
                className='border px-1 py-0.5 text-xs w-full'
                type='number'
                value={Number(params[k]) || spec.defaultValue}
                onChange={(e) => updateParam(k, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
