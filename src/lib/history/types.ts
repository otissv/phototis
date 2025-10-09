import type { Command } from "@/lib/commands/command"

/** Unique identifier for a commit node within the history graph. */
export type CommitId = string
/** Human-readable name for a branch in the history graph. */
export type BranchName = string

/**
 * Immutable unit of change recorded in the history graph.
 * A commit may have multiple parents (merge) or none (root).
 */
export interface Commit {
  /** Stable unique id for this commit. */
  id: CommitId
  /** Parent commit ids; empty for root, multiple for merges. */
  parentIds: CommitId[]
  /** Short human-readable label shown in UI (e.g. "Adjust Brightness"). */
  label: string
  /** Creation time as Unix epoch milliseconds. */
  timestamp: number
  /** Optional preview thumbnail (data URL or external URL); null if intentionally absent. */
  thumbnail?: string | null
  /** The exact sequence of editor commands that produced this commit. */
  commands: Command[]
  /** Approximate serialized size in bytes used for budgeting/retention policies. */
  byteSize: number
  /** Optional forward patch to re-apply this commit on its parent. */
  forwardPatch?: unknown
  /** Optional inverse patch to revert this commit. */
  inversePatch?: unknown
}

/**
 * Pointer to the current working position in the graph.
 * Can be attached to a branch tip or be detached at a specific commit.
 */
export interface HeadRef {
  /** Whether the head is attached to a branch or detached at a commit. */
  type: "branch" | "detached"
  /** Branch name when type is "branch"; undefined when detached. */
  name?: BranchName
  /** Commit id that HEAD points to. */
  at: CommitId
}

/**
 * In-memory representation of the full history graph with branch refs
 * and protections used for retention and GC.
 */
export interface HistoryGraph {
  /** Map of commit id to commit payload. */
  commits: Record<CommitId, Commit>
  /** Map of branch name to the branch's tip commit id. */
  branches: Record<BranchName, CommitId>
  /** Adjacency map of commit id to its child commit ids. */
  children: Record<CommitId, CommitId[]>
  /** Current head reference (branch or detached). */
  head: HeadRef
  /** Sets of protected entities that must not be deleted or rewritten. */
  protected: {
    /** Commits that are GC-protected (e.g., pinned, referenced by presets). */
    commits: Set<CommitId>
    /** Branches that are protected from deletion or rewrite. */
    branches: Set<BranchName>
  }
}

/** A single conflict found when applying or rebasing commits. */
export interface ConflictDetail {
  /** Logical path identifying the conflicted entity (e.g., layer/property path). */
  path: string
  /** Human-readable explanation of why the conflict occurred. */
  reason: string
}

/**
 * Aggregate report describing conflicts for a specific commit and
 * optional suggested resolutions.
 */
export interface ConflictReport {
  /** Commit for which conflicts were detected. */
  commitId: CommitId
  /** List of specific conflict details. */
  details: ConflictDetail[]
  /**
   * Optional machine-generated remediation suggestions.
   * Each suggestion may provide a mapping from one path to another or an action to take.
   */
  suggestions?: Array<{
    /** Optional source path to remap from. */
    from?: string
    /** Optional destination path to remap to. */
    to?: string
    /** How to resolve: remap existing path, create a new entity, or skip. */
    action: "remap" | "create" | "skip"
  }>
}

/** Retention policy for unreachable commits. */
export interface RetentionSettings {
  /** Keep at least this many unreachable commits (most recent). */
  keepUnreachableCount: number
  /** Keep unreachable commits not older than this many days. */
  keepUnreachableDays: number
}

/** Global history settings influencing UX and retention. */
export interface HistorySettings {
  /** When operating on a detached head, auto-create a branch to capture new commits. */
  autoCreateBranchOnDetached: boolean
  /** Retention configuration for trimming history. */
  retention: RetentionSettings
}

/**
 * JSON-serializable shape of the history graph used for persistence.
 * Uses plain arrays and primitive-friendly structures.
 */
export interface SerializedHistoryGraph {
  /** Commit map with commands coerced to plain serializable arrays. */
  commits: Record<CommitId, Omit<Commit, "commands"> & { commands: any[] }>
  /** Branch name to tip commit id. */
  branches: Record<BranchName, CommitId>
  /** Adjacency map of commit id to child ids. */
  children: Record<CommitId, CommitId[]>
  /** Serialized head reference. */
  head: HeadRef
  /** Protected entities represented as simple arrays of ids. */
  protected: { commits: CommitId[]; branches: BranchName[] }
}

/** Root object persisted to storage representing a saved history file. */
export interface SerializedHistory {
  /** Schema version discriminator for forwards/backwards compatibility. */
  version: 1
  /** Canonical schema id of this persisted structure. */
  schema: "phototis.history.v1"
  /** Save timestamp as Unix epoch milliseconds. */
  savedAt: number
  /** Serialized graph payload. */
  graph: SerializedHistoryGraph
  /** Optional snapshot cache map: commitId -> serialized canonical snapshot. */
  snapshots?: Record<string, unknown>
  /** Optional persisted partial settings to restore environment defaults. */
  settings?: Partial<HistorySettings>
}
