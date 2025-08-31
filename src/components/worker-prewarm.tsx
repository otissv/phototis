"use client"

import React from "react"
import { WorkerManager } from "@/lib/workers/worker-manager"

export function WorkerPrewarm() {
  React.useEffect(() => {
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

    return () => {
      cancelled = true
      window.removeEventListener("worker-debug", onDbg as EventListener)
    }
  }, [])

  return null
}
