import type { CanonicalEditorState } from "@/lib/editor/state"
import { persistDocument } from "@/lib/editor/persistence"
import { deserializeCommand } from "@/lib/editor/commands"
import type { SerializedEditorDocumentV1 } from "@/lib/editor/persistence"
import type { SerializedCommand } from "@/lib/editor/commands"

export type CommandScope = "layers" | "tool" | "canvas" | "document" | "global"

export interface CommandMeta {
  label: string
  scope: CommandScope
  timestamp?: number
  coalescable?: boolean
  /**
   * If provided, commands with the same mergeKey may be coalesced
   * using the command's coalescing methods.
   */
  mergeKey?: string
  /** If true, command will not be recorded in history (not undoable). */
  nonUndoable?: boolean
  /** Optional estimated payload size in bytes for memory accounting. */
  estimatedSize?: number
}

export interface Command {
  meta: CommandMeta
  apply(state: CanonicalEditorState): CanonicalEditorState
  /**
   * Produce an inverse command given the previous and next states.
   * This must be implemented for undoability unless meta.nonUndoable is true.
   */
  invert(prev: CanonicalEditorState, next: CanonicalEditorState): Command
  /** Optional coalescing hooks */
  canCoalesceWith?(other: Command): boolean
  coalesceWith?(other: Command): Command
  /** Optional precise sizing for memory accounting */
  estimateSize?(): number
}

/**
 * Composite command that applies a sequence of commands and inverts them in reverse order.
 */
export class CompositeCommand implements Command {
  public meta: CommandMeta
  public readonly commands: Command[]

  constructor(
    commands: Command[],
    label = "Composite",
    scope: CommandScope = "global"
  ) {
    this.commands = commands
    this.meta = {
      label,
      scope,
      timestamp: Date.now(),
      coalescable: false,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    let next = state
    for (const cmd of this.commands) {
      next = cmd.apply(next)
    }
    return next
  }

  invert(prev: CanonicalEditorState, next: CanonicalEditorState): Command {
    // Build inverse by inverting each sub-command with progressive state snapshots.
    // We do a forward replay to obtain intermediate states for accurate inversion.
    const forwardStates: CanonicalEditorState[] = [prev]
    let current = prev
    for (const cmd of this.commands) {
      current = cmd.apply(current)
      forwardStates.push(current)
    }
    // Invert in reverse order, using matching snapshots.
    const inverses: Command[] = []
    for (let i = this.commands.length - 1; i >= 0; i -= 1) {
      const cmd = this.commands[i]
      const before = forwardStates[i]
      const after = forwardStates[i + 1]
      inverses.push(cmd.invert(before, after))
    }
    return new CompositeCommand(
      inverses,
      `Undo ${this.meta.label}`,
      this.meta.scope
    )
  }

  estimateSize(): number {
    let sum = 64
    for (const cmd of this.commands) {
      sum +=
        typeof cmd.estimateSize === "function"
          ? cmd.estimateSize()
          : estimateCommandSize(cmd)
    }
    return sum
  }

  serialize(): any {
    return {
      type: "composite",
      meta: this.meta,
      commands: this.commands.map((c) => (c as any).serialize?.()),
    }
  }
}

export interface HistoryEntry {
  label: string
  forward: Command
  inverse: Command
  bytes: number
  /** Optional tiny thumbnail (data URL) for quick visual recall */
  thumbnail?: string | null
}

export interface Checkpoint {
  id: string
  name: string
  atIndex: number // index in past (after applying past[0..atIndex-1])
  state: CanonicalEditorState
  bytes: number
  createdAt: number
}

export interface HistoryManagerOptions {
  /** Max bytes of history (commands + snapshots) to retain */
  maxBytes?: number
  /**
   * Optional coalescing window (ms). When pushing a coalescable command with the same mergeKey
   * within this window, we coalesce with the last command.
   */
  coalesceWindowMs?: number
  autosaveOnTransactionEnd?: boolean
  storageKey?: string
}

export class HistoryManager {
  private readonly getState: () => CanonicalEditorState
  private readonly setState: (
    updater: (s: CanonicalEditorState) => CanonicalEditorState
  ) => void
  private readonly options: {
    maxBytes: number
    coalesceWindowMs: number
    autosaveOnTransactionEnd: boolean
    storageKey?: string
  }

  private past: HistoryEntry[] = []
  private future: HistoryEntry[] = []
  private checkpoints: Checkpoint[] = []
  private baseline: Checkpoint | null = null

  private usedBytes = 0

  private transactions: Array<{
    name: string
    commands: Command[]
    startedAt: number
  }> = []
  private lastCoalesceAt = 0
  private thumbnailProvider:
    | (() => Promise<string | null> | string | null)
    | null = null

  constructor(
    getState: () => CanonicalEditorState,
    setState: (
      updater: (s: CanonicalEditorState) => CanonicalEditorState
    ) => void,
    options?: HistoryManagerOptions
  ) {
    this.getState = getState
    this.setState = setState
    this.options = {
      maxBytes: options?.maxBytes ?? 16 * 1024 * 1024, // 16 MB
      coalesceWindowMs: options?.coalesceWindowMs ?? 100, // 100ms
      autosaveOnTransactionEnd: options?.autosaveOnTransactionEnd ?? false,
      storageKey: options?.storageKey,
    }
    // initial baseline checkpoint
    const initial = this.getState()
    this.baseline = this.createCheckpoint("Initial", 0, initial)
    this.checkpoints.push(this.baseline)
  }

  get canUndo(): boolean {
    return this.past.length > 0 && this.transactions.length === 0
  }

  get canRedo(): boolean {
    return this.future.length > 0 && this.transactions.length === 0
  }

  get isTransactionActive(): boolean {
    return this.transactions.length > 0
  }

  /**
   * Lightweight snapshot of the timeline for UI purposes.
   * - past: oldest -> newest applied labels
   * - future: next redo first -> oldest redo last (reversed for intuitive display)
   */
  inspect(): {
    past: Array<{
      label: string
      thumbnail?: string | null
      scope?: CommandScope
      timestamp?: number
    }>
    future: Array<{
      label: string
      thumbnail?: string | null
      scope?: CommandScope
      timestamp?: number
    }>
    checkpoints: Checkpoint[]
    counts: { past: number; future: number }
    usedBytes: number
    transactionActive: boolean
  } {
    const past = this.past.map((e) => ({
      label: e.label,
      thumbnail: e.thumbnail,
      scope: e.forward.meta.scope,
      timestamp: e.forward.meta.timestamp,
    }))
    const future = [...this.future].reverse().map((e) => ({
      label: e.label,
      thumbnail: e.thumbnail,
      scope: e.forward.meta.scope,
      timestamp: e.forward.meta.timestamp,
    }))
    return {
      past,
      future,
      checkpoints: this.getCheckpoints(),
      counts: { past: this.past.length, future: this.future.length },
      usedBytes: this.usedBytes,
      transactionActive: this.isTransactionActive,
    }
  }

  getPastSize(): number {
    return this.past.length
  }

  getFutureSize(): number {
    return this.future.length
  }

  getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints]
  }

  /** Execute a command immediately (outside of an active transaction). */
  execute(command: Command): void {
    if (this.transactions.length > 0) {
      this.push(command)
      return
    }

    if (command.meta.nonUndoable) {
      try {
        const before = this.getState()
      } catch {}
      this.applyCommand(command)
      this.future = []
      // No entry recorded
      return
    }

    const prev = this.getState()
    const next = command.apply(prev)
    const inverse = command.invert(prev, next)
    const entry = this.createEntry(command, inverse)

    this.setState(() => next)

    this.past.push(entry)
    this.future = []
    this.usedBytes += entry.bytes
    this.enforceMemoryBudget()
    // capture thumbnail in background
    void this.tryCaptureThumbnail().then((thumb) => {
      if (thumb && this.past.length > 0) {
        this.past[this.past.length - 1].thumbnail = thumb
      }
    })
  }

  /** Begin a transaction. Transactions can be nested. */
  beginTransaction(name: string): void {
    this.transactions.push({ name, commands: [], startedAt: Date.now() })
  }

  /** Push a command into the current transaction (or execute if no transaction). */
  push(command: Command): void {
    if (this.transactions.length === 0) {
      this.execute(command)
      return
    }
    const frame = this.transactions[this.transactions.length - 1]

    if (
      command.meta.coalescable &&
      command.meta.mergeKey &&
      frame.commands.length > 0 &&
      Date.now() - this.lastCoalesceAt <= this.options.coalesceWindowMs
    ) {
      const last = frame.commands[frame.commands.length - 1]
      if (
        last.meta.coalescable &&
        last.meta.mergeKey === command.meta.mergeKey &&
        typeof last.canCoalesceWith === "function" &&
        typeof last.coalesceWith === "function" &&
        last.canCoalesceWith(command)
      ) {
        frame.commands[frame.commands.length - 1] = last.coalesceWith(command)
        this.lastCoalesceAt = Date.now()
        return
      }
    }

    frame.commands.push(command)
    this.lastCoalesceAt = Date.now()
  }

  /** End the current transaction. If commit=false, discard. */
  endTransaction(commit = true): void {
    if (this.transactions.length === 0) return

    const popped = this.transactions.pop()
    if (!popped) return

    const frame = popped
    if (!commit || frame.commands.length === 0) {
      return
    }
    const composite = new CompositeCommand(frame.commands, frame.name)

    console.log("transactions.length: ", this.transactions.length)

    if (this.transactions.length > 0) {
      // Nest into parent frame
      this.push(composite)
    } else {
      // Execute as a single history entry
      this.execute(composite)
    }

    if (this.options.autosaveOnTransactionEnd) {
      void this.save(this.options.storageKey)
    }
  }

  cancelTransaction(): void {
    this.endTransaction(false)
  }

  undo(): void {
    if (!this.canUndo) return
    const popped = this.past.pop()
    if (!popped) return
    const entry = popped
    try {
      const prev = this.getState()
      const next = entry.inverse.apply(prev)
      this.setState(() => next)
      this.future.push({
        label: entry.label,
        forward: entry.inverse,
        inverse: entry.forward,
        bytes: entry.bytes,
      })
    } catch {
      // rollback to last safe checkpoint
      const fallback = this.checkpoints[0] || this.baseline
      if (fallback) {
        this.setState(() => fallback.state)
        this.past = this.past.slice(0, fallback.atIndex)
        this.future = []
        this.baseline = fallback
        this.recomputeUsedBytes()
      }
    }
  }

  redo(): void {
    if (!this.canRedo) return
    const popped = this.future.pop()
    if (!popped) return
    const entry = popped
    try {
      const prev = this.getState()
      const next = entry.inverse.apply(prev) // inverse here is the original forward
      this.setState(() => next)
      this.past.push({
        label: entry.label,
        forward: entry.inverse,
        inverse: entry.forward,
        bytes: entry.bytes,
      })
    } catch {
      const fallback = this.checkpoints[0] || this.baseline
      if (fallback) {
        this.setState(() => fallback.state)
        this.past = this.past.slice(0, fallback.atIndex)
        this.future = []
        this.baseline = fallback
        this.recomputeUsedBytes()
      }
    }
  }

  /** Clear redo branch */
  clearRedo(): void {
    this.future = []
  }

  /** Clear entire history while preserving current state as a new baseline checkpoint */
  clearHistory(): void {
    const current = this.getState()
    const cp = this.createCheckpoint("Baseline", 0, current)
    this.past = []
    this.future = []
    this.checkpoints = [cp]
    this.baseline = cp
    this.usedBytes = cp.bytes
  }

  /** Jump directly to a past index (0..past.length-1). Uses undo/redo loops for correctness */
  jumpToIndex(targetPastIndex: number): void {
    const currentIndex = this.past.length - 1
    if (targetPastIndex < 0 || targetPastIndex > currentIndex) return
    const steps = currentIndex - targetPastIndex
    for (let i = 0; i < steps; i += 1) this.undo()
  }

  /** Delete steps after the given past index (exclusive). Keeps current state consistent by performing undos as needed */
  deleteStepsAfterIndex(targetPastIndex: number): void {
    const currentIndex = this.past.length - 1
    if (targetPastIndex < 0 || targetPastIndex > currentIndex) return
    const steps = currentIndex - targetPastIndex
    for (let i = 0; i < steps; i += 1) this.undo()
  }

  /** Delete steps before the given past index (inclusive) without changing current state */
  deleteStepsBeforeIndex(targetPastIndex: number): void {
    if (targetPastIndex <= 0) return
    this.past = this.past.slice(targetPastIndex)
    // Update checkpoints to reflect trimmed history
    this.checkpoints = this.checkpoints.map((cp) => ({
      ...cp,
      atIndex: Math.max(0, cp.atIndex - targetPastIndex),
    }))
    this.recomputeUsedBytes()
  }

  /** Compute the document state at a specific past index (0..past.length-1) without mutating current */
  computeStateAtIndex(targetPastIndex: number): CanonicalEditorState {
    const base = this.baseline ?? this.checkpoints[0]
    if (!base) return this.getState()
    // Start from baseline state and apply entries from baseline.atIndex..targetPastIndex
    let current = base.state
    const start = Math.max(base.atIndex, 0)
    const end = Math.min(targetPastIndex, this.past.length - 1)
    for (let i = start; i <= end; i += 1) {
      const entry = this.past[i]
      if (!entry) break
      current = entry.forward.apply(current)
    }
    return current
  }

  /** Build a serialized document at a specific past index */
  exportDocumentAtIndex(targetPastIndex: number): SerializedEditorDocumentV1 {
    const state = this.computeStateAtIndex(targetPastIndex)
    return {
      version: 1,
      schema: "phototis.editor.v1",
      savedAt: Date.now(),
      state,
      history: { past: [], future: [], checkpoints: [], baseline: null },
    }
  }

  /** Register a provider that can produce a tiny thumbnail for the current state */
  setThumbnailProvider(
    provider: (() => Promise<string | null> | string | null) | null
  ): void {
    this.thumbnailProvider = provider
  }

  /** Update maximum memory budget in bytes and enforce immediately */
  setMaxBytes(maxBytes: number): void {
    this.options.maxBytes = Math.max(1 * 1024 * 1024, maxBytes)
    this.enforceMemoryBudget()
  }

  private async tryCaptureThumbnail(): Promise<string | null> {
    try {
      const p = this.thumbnailProvider
      if (!p) return null
      const res = typeof p === "function" ? await p() : p
      return res ?? null
    } catch {
      return null
    }
  }

  addCheckpoint(name: string): Checkpoint {
    const cp = this.createCheckpoint(name, this.past.length, this.getState())
    this.checkpoints.push(cp)
    this.usedBytes += cp.bytes
    this.enforceMemoryBudget()
    return cp
  }

  /** Jump to a checkpoint, resetting redo branch and trimming history appropriately. */
  jumpToCheckpoint(id: string): void {
    const idx = this.checkpoints.findIndex((c) => c.id === id)
    if (idx < 0) return
    const cp = this.checkpoints[idx]
    this.setState(() => cp.state)
    // Reset history to the checkpoint boundary
    this.past = this.past.slice(0, cp.atIndex)
    this.future = []
    // Baseline becomes this checkpoint
    this.baseline = { ...cp }
    // Drop older checkpoints
    this.checkpoints = this.checkpoints.slice(idx)
    // Recompute used bytes
    this.recomputeUsedBytes()
  }

  /** Internal helpers */
  private applyCommand(command: Command): void {
    this.setState((s) => command.apply(s))
  }

  private createEntry(forward: Command, inverse: Command): HistoryEntry {
    const label = forward.meta.label
    const bytes =
      (typeof forward.estimateSize === "function"
        ? forward.estimateSize()
        : estimateCommandSize(forward)) +
      (typeof inverse.estimateSize === "function"
        ? inverse.estimateSize()
        : estimateCommandSize(inverse))
    // thumbnails are captured lazily by UI trigger to avoid blocking; initialize as undefined
    return { label, forward, inverse, bytes, thumbnail: undefined }
  }

  private createCheckpoint(
    name: string,
    atIndex: number,
    state: CanonicalEditorState
  ): Checkpoint {
    const serialized = JSON.stringify(state)
    return {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      atIndex,
      state,
      bytes: serialized.length,
      createdAt: Date.now(),
    }
  }

  private enforceMemoryBudget(): void {
    const maxBytes = this.options.maxBytes
    if (this.usedBytes <= maxBytes) return

    // Merge oldest entries into baseline checkpoint until under budget or no more entries.
    if (!this.baseline) {
      this.baseline = this.createCheckpoint("Baseline", 0, this.getState())
      this.checkpoints.unshift(this.baseline)
      this.usedBytes += this.baseline.bytes
    }

    while (this.usedBytes > maxBytes && this.past.length > 0) {
      const oldest = this.past.shift()
      if (!oldest) break
      // Apply oldest forward to baseline state to maintain equivalence
      this.baseline = this.createCheckpoint(
        this.baseline.name,
        Math.max(0, this.baseline.atIndex - 1),
        oldest.forward.apply(this.baseline.state)
      )
      // Adjust used bytes: remove entry, add new baseline bytes (approx)
      this.usedBytes -= oldest.bytes
      // Replace baseline in checkpoints[0]
      if (this.checkpoints.length > 0) {
        this.checkpoints[0] = this.baseline
      } else {
        this.checkpoints.push(this.baseline)
      }
      this.usedBytes += this.baseline.bytes
    }

    // If still exceeding (extreme), snapshot current and clear history
    if (this.usedBytes > maxBytes) {
      const current = this.getState()
      const cp = this.createCheckpoint("Compacted", 0, current)
      this.past = []
      this.future = []
      this.checkpoints = [cp]
      this.baseline = cp
      this.usedBytes = cp.bytes
    }
  }

  private recomputeUsedBytes(): void {
    let bytes = 0
    if (this.baseline) bytes += this.baseline.bytes
    for (const e of this.past) bytes += e.bytes
    for (const c of this.checkpoints) bytes += c.bytes
    this.usedBytes = bytes
  }

  /** Serialize history metadata (commands are reduced to serializable forms). */
  toSerializable(): SerializedEditorDocumentV1["history"] {
    const serializeEntry = (e: HistoryEntry) => ({
      label: e.label,
      forward: (e.forward as any).serialize?.() as SerializedCommand,
      inverse: (e.inverse as any).serialize?.() as SerializedCommand,
      bytes: e.bytes,
      thumbnail: e.thumbnail ?? null,
    })
    return {
      past: this.past.map(serializeEntry),
      future: this.future.map(serializeEntry),
      checkpoints: this.checkpoints,
      baseline: this.baseline,
    }
  }

  /** Persist current document (state + history metadata). */
  async save(key = "phototis:editor"): Promise<void> {
    await persistDocument(key, this.getState(), this.toSerializable())
  }

  rehydrate(serial: SerializedEditorDocumentV1["history"]): void {
    const revive = (sc: any): any => {
      if (!sc) return sc
      if (sc.type === "composite") {
        const child = (sc.commands || []).map((c: any) => revive(c))
        const cc = new CompositeCommand(
          child,
          sc.meta?.label ?? "Composite",
          sc.meta?.scope ?? "global"
        )
        cc.meta = { ...cc.meta, ...sc.meta }
        return cc
      }
      return deserializeCommand(sc)
    }
    const reviveEntry = (e: any) => ({
      label: e.label,
      forward: revive(e.forward),
      inverse: revive(e.inverse),
      bytes: e.bytes,
      thumbnail: e.thumbnail ?? null,
    })
    this.past = (serial.past || []).map(reviveEntry)
    this.future = (serial.future || []).map(reviveEntry)
    this.checkpoints = serial.checkpoints || []
    this.baseline = serial.baseline ?? null
    this.recomputeUsedBytes()
  }
}

function estimateCommandSize(cmd: Command): number {
  try {
    const metaJson = JSON.stringify(cmd.meta)
    // Heuristic fallback if command doesn't provide its own size
    return 128 + metaJson.length
  } catch {
    return 256
  }
}
