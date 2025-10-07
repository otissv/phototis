import type { Command } from "@/lib/commands/command"

export type CommitId = string
export type BranchName = string

export interface Commit {
  id: CommitId
  parentIds: CommitId[]
  label: string
  timestamp: number
  thumbnail?: string | null
  commands: Command[]
  byteSize: number
  forwardPatch?: unknown
  inversePatch?: unknown
}

export interface HeadRef {
  type: "branch" | "detached"
  name?: BranchName
  at: CommitId
}

export interface HistoryGraph {
  commits: Record<CommitId, Commit>
  branches: Record<BranchName, CommitId>
  children: Record<CommitId, CommitId[]>
  head: HeadRef
  protected: { commits: Set<CommitId>; branches: Set<BranchName> }
}

export interface ConflictDetail {
  path: string
  reason: string
}

export interface ConflictReport {
  commitId: CommitId
  details: ConflictDetail[]
  suggestions?: Array<{
    from?: string
    to?: string
    action: "remap" | "create" | "skip"
  }>
}

export interface RetentionSettings {
  keepUnreachableCount: number
  keepUnreachableDays: number
}

export interface HistorySettings {
  autoCreateBranchOnDetached: boolean
  retention: RetentionSettings
}

export interface SerializedHistoryGraph {
  commits: Record<CommitId, Omit<Commit, "commands"> & { commands: any[] }>
  branches: Record<BranchName, CommitId>
  children: Record<CommitId, CommitId[]>
  head: HeadRef
  protected: { commits: CommitId[]; branches: BranchName[] }
}

export interface SerializedHistory {
  version: 1
  schema: "phototis.history.v1"
  savedAt: number
  graph: SerializedHistoryGraph
  // Optional snapshot cache map: commitId -> serialized canonical snapshot
  snapshots?: Record<string, unknown>
  settings?: Partial<HistorySettings>
}
