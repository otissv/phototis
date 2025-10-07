import type { CanonicalEditorState } from "@/lib/editor/state"
import { persistDocument, loadDocument } from "@/lib/editor/persistence"
import type { HistoryGraph, HistorySettings, SerializedHistory } from "./types"

export interface HistoryStorageAdapter {
  save(key: string, data: string): Promise<void>
  load(key: string): Promise<string | null>
}

export class LocalHistoryStorageAdapter implements HistoryStorageAdapter {
  async save(key: string, data: string): Promise<void> {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, data)
  }
  async load(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(key)
  }
}

export function serializeHistory(
  graph: HistoryGraph,
  snapshots?: Record<string, unknown>,
  settings?: Partial<HistorySettings>
): SerializedHistory {
  const commits: SerializedHistory["graph"]["commits"] = {}
  for (const [id, c] of Object.entries(graph.commits)) {
    commits[id] = {
      id: c.id,
      parentIds: [...c.parentIds],
      label: c.label,
      timestamp: c.timestamp,
      thumbnail: c.thumbnail ?? null,
      byteSize: c.byteSize,
      forwardPatch: c.forwardPatch,
      inversePatch: c.inversePatch,
      // Commands are serialized by the app's own command serializer when exporting full document.
      // Here we keep runtime references to allow replay within a session export.
      commands: (c.commands as any[]).map(
        (cmd) => (cmd as any).serialize?.() ?? null
      ),
    }
  }
  return {
    version: 1,
    schema: "phototis.history.v1",
    savedAt: Date.now(),
    graph: {
      commits,
      branches: { ...graph.branches },
      children: { ...graph.children },
      head: { ...graph.head },
      protected: {
        commits: Array.from(graph.protected.commits),
        branches: Array.from(graph.protected.branches),
      },
    },
    snapshots: snapshots ? { ...snapshots } : undefined,
    settings: settings ? { ...settings } : undefined,
  }
}

export function deserializeHistory(
  payload: SerializedHistory
): SerializedHistory {
  // For now we trust schema; command rehydration happens in manager using project deserializer
  return payload
}

export async function autosave(
  key: string,
  state: CanonicalEditorState,
  historyGraph: HistoryGraph
): Promise<void> {
  await persistDocument(key, state, {
    past: [],
    future: [],
    checkpoints: [],
    baseline: null,
  })
  // Also store history graph separately for portability
  const historyKey = `${key}:graph`
  const serial = serializeHistory(historyGraph)
  const adapter = new LocalHistoryStorageAdapter()
  await adapter.save(historyKey, JSON.stringify(serial))
}

export async function loadAutosaved(key: string): Promise<{
  state: CanonicalEditorState | null
  history: SerializedHistory | null
}> {
  const doc = await loadDocument(key)
  const graphKey = `${key}:graph`
  const adapter = new LocalHistoryStorageAdapter()
  let hist: SerializedHistory | null = null
  try {
    const raw = await adapter.load(graphKey)
    if (raw) hist = JSON.parse(raw) as SerializedHistory
  } catch {
    hist = null
  }
  return { state: doc?.state ?? null, history: hist }
}
