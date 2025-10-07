import type { CanonicalEditorState } from "@/lib/editor/state"

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
  /** Optional nested commands when composite. */
  commands?: Command[]
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

  invert(prev: CanonicalEditorState, _next: CanonicalEditorState): Command {
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

export function estimateCommandSize(cmd: Command): number {
  try {
    const metaJson = JSON.stringify(cmd.meta)
    // Heuristic fallback if command doesn't provide its own size
    return 128 + metaJson.length
  } catch {
    return 256
  }
}
