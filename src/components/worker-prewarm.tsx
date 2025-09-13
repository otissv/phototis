"use client"

import React from "react"
import { WorkerManager } from "@/lib/workers/worker-manager"
import { useEditorContext } from "@/lib/editor/context"
import { config } from "@/config"

const { isDebug } = config()

export function WorkerPrewarm() {
  const { renderType } = useEditorContext()
  React.useEffect(() => {
    if (renderType === "hybrid") return

    let cancelled = false
    const run = async () => {
      try {
        const m = WorkerManager.getShared()
        await m.prepare()
      } catch {}
    }
    void run()

    // Optional: attach debug timeline logger
    const onDbg = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail
      } catch {}
    }
    window.addEventListener("worker-debug", onDbg as EventListener)

    isDebug && console.debug("[Worker Debug] worker renderer prewarmed")

    return () => {
      cancelled = true
      window.removeEventListener("worker-debug", onDbg as EventListener)
    }
  }, [renderType])

  return null
}
