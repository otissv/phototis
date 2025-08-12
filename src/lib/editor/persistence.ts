import type { CanonicalEditorState } from "@/lib/editor/state"
import { validateEditorState } from "@/lib/editor/state"
import type { SerializedCommand } from "@/lib/editor/commands"

export interface SerializedHistoryEntry {
  label: string
  forward: SerializedCommand
  inverse: SerializedCommand
  bytes: number
  /** Optional tiny thumbnail (data URL) for quick visual recall */
  thumbnail?: string | null
}

export interface SerializedCheckpoint {
  id: string
  name: string
  atIndex: number
  state: CanonicalEditorState
  bytes: number
  createdAt: number
}

export interface SerializedEditorDocumentV1 {
  version: 1
  schema: "phototis.editor.v1"
  savedAt: number
  state: CanonicalEditorState
  history: {
    past: SerializedHistoryEntry[]
    future: SerializedHistoryEntry[]
    checkpoints: SerializedCheckpoint[]
    baseline?: SerializedCheckpoint | null
  }
}

export type AnySerialized = SerializedEditorDocumentV1

export function serializeV1(
  state: CanonicalEditorState,
  history: SerializedEditorDocumentV1["history"]
): SerializedEditorDocumentV1 {
  return {
    version: 1,
    schema: "phototis.editor.v1",
    savedAt: Date.now(),
    state,
    history,
  }
}

export function validateAndMigrate(
  doc: AnySerialized
): SerializedEditorDocumentV1 {
  switch (doc.version) {
    case 1: {
      const valid = validateEditorState(doc.state)
      if (!valid.ok) {
        throw new Error(
          `Invalid state in persisted document: ${valid.errors
            .map((e) => `${e.path}:${e.message}`)
            .join(", ")}`
        )
      }
      return doc
    }
    // Future versions: migrate here
    default:
      throw new Error(`Unsupported version: ${(doc as any).version}`)
  }
}

// Storage adapters
export interface StorageAdapter {
  save(key: string, data: string): Promise<void>
  load(key: string): Promise<string | null>
}

export class LocalStorageAdapter implements StorageAdapter {
  async save(key: string, data: string): Promise<void> {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, data)
  }
  async load(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(key)
  }
}

export async function persistDocument(
  key: string,
  state: CanonicalEditorState,
  history: SerializedEditorDocumentV1["history"],
  storage: StorageAdapter = new LocalStorageAdapter()
): Promise<void> {
  // const doc = serializeV1(state, history)
  // await storage.save(key, JSON.stringify(doc))
}

export async function loadDocument(
  key: string,
  storage: StorageAdapter = new LocalStorageAdapter()
): Promise<SerializedEditorDocumentV1 | null> {
  // const raw = await storage.load(key)
  // if (!raw) return null
  // const parsed = JSON.parse(raw) as AnySerialized
  // const migrated = validateAndMigrate(parsed)
  // return migrated
}
