import type { CanonicalEditorState } from "@/lib/editor/state"
import {
  deserializeCommand,
  type SerializedCommand,
} from "@/lib/commands/commands"
import type { Command } from "@/lib/commands/command"
import { CompositeCommand } from "@/lib/commands/command"
import type {
  Commit,
  CommitId,
  ConflictReport,
  HeadRef,
  HistoryGraph,
  SerializedHistory,
  HistorySettings,
  RetentionSettings,
} from "./types"
import { buildChildrenIndex, computeDelta } from "./graph-utils"
import { serializeHistory, autosave as autosaveDoc } from "./persistence"
import { replayDelta as replayDeltaHelpers } from "@/lib/editor/state"

type GetState = () => CanonicalEditorState
type SetState = (
  updater: (s: CanonicalEditorState) => CanonicalEditorState
) => void

export interface DagHistoryOptions {
  maxBytes?: number
  storageKey?: string
  autosave?: boolean
}

export class DagHistoryManager {
  private readonly getState: GetState
  private readonly setState: SetState
  private readonly options: Required<DagHistoryOptions>

  private graph: HistoryGraph
  private activeTxn: { name: string; commands: Command[] } | null = null
  private thumbnailProvider:
    | (() => Promise<string | null> | string | null)
    | null = null
  private snapshots: Map<CommitId, CanonicalEditorState> = new Map()
  private settings: HistorySettings = {
    autoCreateBranchOnDetached: true,
    retention: { keepUnreachableCount: 50, keepUnreachableDays: 7 },
  }

  constructor(
    getState: GetState,
    setState: SetState,
    opts?: DagHistoryOptions
  ) {
    this.getState = getState
    this.setState = setState
    this.options = {
      maxBytes: opts?.maxBytes ?? 32 * 1024 * 1024,
      storageKey: opts?.storageKey ?? "phototis:editor",
      autosave: opts?.autosave ?? true,
    }
    const rootId = this.generateId("root")
    const rootCommit: Commit = {
      id: rootId,
      parentIds: [],
      label: "Initial",
      timestamp: Date.now(),
      thumbnail: null,
      commands: [],
      byteSize: 0,
    }
    this.graph = {
      commits: { [rootId]: rootCommit },
      branches: { main: rootId },
      children: { [rootId]: [] },
      head: { type: "branch", name: "main", at: rootId },
      protected: { commits: new Set([rootId]), branches: new Set(["main"]) },
    }
    this.snapshots.set(rootId, this.getState())
  }

  // Public API surface per spec
  getGraph(): HistoryGraph {
    return {
      commits: { ...this.graph.commits },
      branches: { ...this.graph.branches },
      children: { ...this.graph.children },
      head: { ...this.graph.head },
      protected: {
        commits: new Set(this.graph.protected.commits),
        branches: new Set(this.graph.protected.branches),
      },
    }
  }

  head(): HeadRef {
    return { ...this.graph.head }
  }

  listBranches(): Array<{ name: string; tip: string }> {
    return Object.entries(this.graph.branches).map(([name, tip]) => ({
      name,
      tip,
    }))
  }

  createBranch(name: string, at?: string): void {
    if (!name || this.graph.branches[name]) return
    const base = at ?? this.graph.head.at
    if (!this.graph.commits[base]) return
    this.graph.branches[name] = base
    this.graph.protected.branches.add(name)
  }

  renameBranch(oldName: string, newName: string): void {
    if (
      !this.graph.branches[oldName] ||
      !newName ||
      this.graph.branches[newName]
    )
      return
    const tip = this.graph.branches[oldName]
    delete this.graph.branches[oldName]
    this.graph.branches[newName] = tip
    if (this.graph.protected.branches.has(oldName)) {
      this.graph.protected.branches.delete(oldName)
      this.graph.protected.branches.add(newName)
    }
    if (this.graph.head.type === "branch" && this.graph.head.name === oldName) {
      this.graph.head = { type: "branch", name: newName, at: tip }
    }
  }

  deleteBranch(name: string): void {
    if (!this.graph.branches[name]) return
    // do not allow deleting current head branch
    if (this.graph.head.type === "branch" && this.graph.head.name === name)
      return
    delete this.graph.branches[name]
    this.graph.protected.branches.delete(name)
  }

  async checkout(ref: { branch?: string; commitId?: string }): Promise<void> {
    let target: CommitId | null = null
    if (ref.branch) {
      const tip = this.graph.branches[ref.branch]
      if (!tip) return
      target = tip
    } else if (ref.commitId) {
      if (!this.graph.commits[ref.commitId]) return
      target = ref.commitId
    }
    if (!target) return

    const cur = this.graph.head.at
    const { undo, redo } = computeDelta(this.graph, cur, target)

    // Undo/redo via time-travel helpers
    const inverses = undo.map((id) => {
      const commit = this.graph.commits[id]
      const inv = this.inverseOf(commit)
      return (s: CanonicalEditorState) => inv.apply(s)
    })
    const forwards = redo.map((id) => {
      const commit = this.graph.commits[id]
      return (s: CanonicalEditorState) => this.applyCommit(commit, s)
    })
    this.setState((s) => replayDeltaHelpers(s, inverses, forwards).state)

    if (ref.branch) {
      this.graph.head = { type: "branch", name: ref.branch, at: target }
    } else {
      this.graph.head = { type: "detached", at: target }
    }
  }

  async commit(label?: string): Promise<string> {
    if (!this.activeTxn) return this.graph.head.at
    const frame = this.activeTxn
    this.activeTxn = null
    if (frame.commands.length === 0) return this.graph.head.at

    const composite = new CompositeCommand(frame.commands, label ?? frame.name)
    let parent = this.graph.head.at
    // Detached-HEAD policy
    if (this.graph.head.type === "detached") {
      if (!this.settings.autoCreateBranchOnDetached) {
        throw new Error(
          "Detached HEAD: create a branch before committing or enable autoCreateBranchOnDetached"
        )
      }
      const short = this.generateId("c").slice(0, 7)
      const name = `branch/${short}`
      this.graph.branches[name] = parent
      this.graph.protected.branches.add(name)
      this.graph.head = { type: "branch", name, at: parent }
    }
    parent = this.graph.head.at
    const id = this.generateId("c")
    const byteSize =
      typeof composite.estimateSize === "function"
        ? composite.estimateSize()
        : 256 + JSON.stringify(composite.meta).length

    let thumb: string | null = null
    try {
      const p = this.thumbnailProvider
      const res = typeof p === "function" ? await p() : p
      thumb = res ?? null
    } catch {
      thumb = null
    }

    const commit: Commit = {
      id,
      parentIds: [parent],
      label: label ?? frame.name,
      timestamp: Date.now(),
      thumbnail: thumb,
      commands: [composite],
      byteSize,
    }
    this.graph.commits[id] = commit
    this.graph.children[parent] = [...(this.graph.children[parent] || []), id]
    // Advance branch tip or detached HEAD
    if (this.graph.head.type === "branch" && this.graph.head.name) {
      this.graph.branches[this.graph.head.name] = id
      this.graph.head = { type: "branch", name: this.graph.head.name, at: id }
    } else {
      this.graph.head = { type: "detached", at: id }
    }

    // Snapshot cache (optional)
    this.snapshots.set(id, this.getState())

    return id
  }

  async undo(): Promise<void> {
    const at = this.graph.head.at
    const commit = this.graph.commits[at]
    if (!commit || commit.parentIds.length === 0) return
    const parent = commit.parentIds[0]
    // Apply inverse
    const inverse = this.inverseOf(commit)
    this.setState((s) => inverse.apply(s))
    this.graph.head = { ...this.graph.head, at: parent }
  }

  async redo(): Promise<void> {
    // Redo only along current branch child if unique
    const at = this.graph.head.at
    const children = this.graph.children[at] || []
    if (children.length !== 1) return
    const next = children[0]
    const commit = this.graph.commits[next]
    if (!commit) return
    this.setState((s) => this.applyCommit(commit, s))
    if (this.graph.head.type === "branch" && this.graph.head.name) {
      this.graph.branches[this.graph.head.name] = next
    }
    this.graph.head = { ...this.graph.head, at: next }
  }

  async cherryPick(
    commitId: string
  ): Promise<{ ok: true } | { ok: false; conflicts: ConflictReport }> {
    const target = this.graph.commits[commitId]
    if (!target) return { ok: true }
    // Deterministic resolver: attempt stable name+type mapping, fallback to create, else conflict
    const result = this.applyWithResolver(target)
    if (!result.ok) return { ok: false, conflicts: result.conflicts }
    this.beginTransaction(`cherry-pick ${commitId}`)
    for (const cmd of result.applied) this.push(cmd)
    await this.commit(`cherry-pick ${target.label}`)
    return { ok: true }
  }

  async revert(commitId: string): Promise<void> {
    const target = this.graph.commits[commitId]
    if (!target) return
    // Apply inverse of the target commit onto current state
    const inverse = this.inverseOf(target)
    this.beginTransaction(`revert ${target.label}`)
    // Split composite back into subcommands by serializing and deserializing inverses
    const prev = this.getState()
    const next = inverse.apply(prev)
    const back = inverse.invert(prev, next)
    if (
      back &&
      (back as any).commands &&
      Array.isArray((back as any).commands)
    ) {
      for (const c of (back as any).commands as Command[]) this.push(c)
    } else {
      this.push(inverse)
    }
    await this.commit(`revert ${target.label}`)
  }

  async squash(commitIds: string[]): Promise<string> {
    const input = commitIds.filter((id) => this.graph.commits[id])
    if (input.length === 0) return this.graph.head.at
    const start = this.graph.commits[input[0]]
    const end = this.graph.commits[input[input.length - 1]]
    if (!start || !end) return this.graph.head.at
    // Compute first-parent path from start -> end
    // Build first-parent chain from start to end
    // Build index of first-parent chain by traversing parentIds[0] backwards from end
    const chain: string[] = []
    let cur: Commit | undefined = end
    while (cur) {
      chain.push(cur.id)
      const pid: string | undefined = cur.parentIds[0]
      if (!pid) break
      cur = this.graph.commits[pid]
      if (pid === start.id) {
        chain.push(start.id)
        break
      }
    }
    // chain now from end -> ... -> start (maybe)
    if (chain[chain.length - 1] !== start.id) {
      throw new Error(
        "NonLinearRange: end is not descendant of start by first-parent"
      )
    }
    chain.reverse() // start..end

    // Merge commands in chain range
    const first = this.graph.commits[chain[0]] as Commit
    const last = this.graph.commits[chain[chain.length - 1]] as Commit
    const merged = new CompositeCommand(
      chain.flatMap((id) => this.graph.commits[id].commands),
      `${first.label} … ${last.label}`
    )
    const parent = first.parentIds[0] ?? null
    if (!parent) return this.graph.head.at
    const id = this.generateId("squash")
    const commit: Commit = {
      id,
      parentIds: [parent],
      label: `${first.label} … ${last.label}`,
      timestamp: Date.now(),
      thumbnail: last.thumbnail ?? null,
      commands: [merged],
      byteSize:
        typeof merged.estimateSize === "function"
          ? merged.estimateSize()
          : 256 + JSON.stringify(merged.meta).length,
    }
    this.graph.commits[id] = commit
    // Rewire children
    const kids = this.graph.children[last.id] || []
    this.graph.children[parent] = (this.graph.children[parent] || []).filter(
      (c) => !chain.includes(c)
    )
    this.graph.children[parent].push(id)
    this.graph.children[id] = [...kids]
    for (const k of kids) {
      const c = this.graph.commits[k]
      if (c) c.parentIds = c.parentIds.map((p) => (p === last.id ? id : p))
    }
    // Drop old commits in the chain
    for (const drop of chain) delete this.graph.commits[drop]
    // Update branch tips if they pointed to last
    for (const [b, tip] of Object.entries(this.graph.branches)) {
      if (chain.includes(tip)) this.graph.branches[b] = id
    }
    if (chain.includes(this.graph.head.at))
      this.graph.head = { ...this.graph.head, at: id }
    return id
  }

  label(commitId: string, label: string): void {
    const c = this.graph.commits[commitId]
    if (!c) return
    c.label = label
  }

  gc(): void {
    // Budget applies to unreachable only; keep newest K unreachable
    const reachable = new Set<string>()
    // Mark reachable from all branches and head
    const seeds = new Set<CommitId>([
      ...Object.values(this.graph.branches),
      this.graph.head.at,
    ])
    const stack = Array.from(seeds)
    while (stack.length) {
      const cur = stack.pop() as CommitId
      if (reachable.has(cur)) continue
      reachable.add(cur)
      const c = this.graph.commits[cur]
      if (c) stack.push(...c.parentIds)
    }
    const unreachable = Object.values(this.graph.commits)
      .filter(
        (c) => !reachable.has(c.id) && !this.graph.protected.commits.has(c.id)
      )
      .sort((a, b) => b.timestamp - a.timestamp)

    let bytes = 0
    for (const c of unreachable) bytes += c.byteSize
    // Keep newest unreachable according to retention
    const keepCount = Math.max(0, this.settings.retention.keepUnreachableCount)
    const keep = new Set(unreachable.slice(0, keepCount).map((c) => c.id))
    const cutoffMs =
      Date.now() -
      Math.max(0, this.settings.retention.keepUnreachableDays) *
        24 *
        60 *
        60 *
        1000
    for (const c of unreachable.slice(keepCount)) {
      if (bytes <= this.options.maxBytes) break
      if (keep.has(c.id)) continue
      if (c.timestamp >= cutoffMs) continue
      delete this.graph.commits[c.id]
      delete this.graph.children[c.id]
      this.snapshots.delete(c.id)
      bytes -= c.byteSize
    }
    // Rebuild children index for safety
    this.graph.children = buildChildrenIndex(this.graph)
  }

  export(): SerializedHistory {
    return serializeHistory(this.graph, undefined, this.settings)
  }

  async import(payload: SerializedHistory): Promise<void> {
    // Rehydrate graph, rebuild children, set head, best-effort state via replay from root to head
    const g: HistoryGraph = {
      commits: {},
      branches: { ...payload.graph.branches },
      children: { ...payload.graph.children },
      head: { ...payload.graph.head },
      protected: {
        commits: new Set(payload.graph.protected.commits),
        branches: new Set(payload.graph.protected.branches),
      },
    }
    // Commands are stored as serialized forms; revive using project deserializer
    for (const [id, sc] of Object.entries(payload.graph.commits)) {
      const cmds: Command[] = []
      for (const c of sc.commands) {
        const revived = this.reviveCommand(c)
        if (revived) cmds.push(revived)
      }
      g.commits[id] = {
        id: sc.id,
        parentIds: [...sc.parentIds],
        label: sc.label,
        timestamp: sc.timestamp,
        thumbnail: sc.thumbnail ?? null,
        byteSize: sc.byteSize,
        forwardPatch: sc.forwardPatch,
        inversePatch: sc.inversePatch,
        commands: cmds,
      }
    }
    g.children = buildChildrenIndex(g)
    this.graph = g
    // Replay to HEAD
    await this.checkout({ commitId: this.graph.head.at })
  }

  async save(key = this.options.storageKey): Promise<void> {
    try {
      await autosaveDoc(key, this.getState(), this.graph)
    } catch {}
  }

  // Compatibility shim used by EditorProvider
  beginTransaction(name: string): void {
    if (this.activeTxn) return
    this.activeTxn = { name, commands: [] }
  }
  push(command: Command): void {
    if (!this.activeTxn) {
      // immediate execute non-transactional
      this.setState((s) => command.apply(s))
      return
    }
    this.activeTxn.commands.push(command)
  }
  endTransaction(commit = true): void {
    if (!this.activeTxn) return
    if (!commit) {
      this.activeTxn = null
      return
    }
    // Apply forward to state immediately; commit() will record DAG node
    const composite = new CompositeCommand(
      this.activeTxn.commands,
      this.activeTxn.name
    )
    this.setState((s) => composite.apply(s))
    void this.commit(this.activeTxn.name)
  }

  setThumbnailProvider(
    provider: (() => Promise<string | null> | string | null) | null
  ): void {
    this.thumbnailProvider = provider
  }

  cancelTransaction(): void {
    this.activeTxn = null
  }

  execute(command: Command): void {
    if (command && (command as any).meta && (command as any).meta.nonUndoable) {
      this.setState((s) => command.apply(s))
      return
    }
    const name = (command as any)?.meta?.label || "Edit"
    this.beginTransaction(name)
    this.push(command)
    this.endTransaction(true)
  }

  // New APIs
  async merge({
    ours,
    theirs,
    label,
  }: {
    ours: string
    theirs: string
    label?: string
  }): Promise<string> {
    const a = this.graph.commits[ours]
    const b = this.graph.commits[theirs]
    if (!a || !b) return this.graph.head.at
    // Replay delta of theirs onto ours using resolver
    await this.checkout({ commitId: ours })
    const applyResult = this.applyWithResolver(b)
    if (!applyResult.ok) throw new Error("Merge conflict")
    this.beginTransaction(label ?? `merge ${theirs} into ${ours}`)
    for (const cmd of applyResult.applied) this.push(cmd)
    const id = await this.commit(label ?? `merge ${theirs} into ${ours}`)
    // Set two parents
    this.graph.commits[id].parentIds = [ours, theirs]
    // Restore head to merged commit
    return id
  }

  async materializeAt(id: string): Promise<void> {
    await this.checkout({ commitId: id })
  }

  async replayDelta(fromId: string, toId: string): Promise<void> {
    const { undo, redo } = computeDelta(
      this.graph,
      fromId as CommitId,
      toId as CommitId
    )
    const inverses = undo.map((uid) => {
      const c = this.graph.commits[uid]
      const inv = this.inverseOf(c)
      return (s: CanonicalEditorState) => inv.apply(s)
    })
    const forwards = redo.map((rid) => {
      const c = this.graph.commits[rid]
      return (s: CanonicalEditorState) => this.applyCommit(c, s)
    })
    this.setState((s) => replayDeltaHelpers(s, inverses, forwards).state)
    this.graph.head = { ...this.graph.head, at: toId as CommitId }
  }

  setRetention(settings: Partial<RetentionSettings>): void {
    this.settings.retention = {
      keepUnreachableCount:
        settings.keepUnreachableCount ??
        this.settings.retention.keepUnreachableCount,
      keepUnreachableDays:
        settings.keepUnreachableDays ??
        this.settings.retention.keepUnreachableDays,
    }
  }

  setAutoCreateBranchOnDetached(auto: boolean): void {
    this.settings.autoCreateBranchOnDetached = Boolean(auto)
  }

  // Internal resolver applying commands with name/type mapping and remap/create
  private applyWithResolver(
    source: Commit
  ):
    | { ok: true; applied: Command[] }
    | { ok: false; conflicts: ConflictReport } {
    // 1) Serialize commands to inspect payloads
    const serialized: any[] = []
    for (const cmd of source.commands) {
      const sc = (cmd as any).serialize?.()
      if (!sc) {
        return {
          ok: false,
          conflicts: {
            commitId: source.id,
            details: [{ path: "command", reason: "Unserializable command" }],
          },
        }
      }
      serialized.push(sc)
    }

    // 2) Build current layer maps
    const current = this.getState()
    const currentById: Record<
      string,
      { id: string; name?: string; type?: string }
    > = {}
    const currentByNameType: Record<string, string> = {}
    for (const id of current.layers.order) {
      const layer = (current.layers.byId as any)[id]
      const name =
        typeof layer?.name === "string" ? (layer.name as string) : undefined
      const type =
        typeof layer?.type === "string" ? (layer.type as string) : undefined
      currentById[id] = { id, name, type }
      if (name && type) currentByNameType[`${type}::${name}`] = id
    }

    // 3) Extract layer infos from serialized commands: srcId -> {name,type}; detect add-layer entries
    const srcInfo: Record<
      string,
      { name?: string; type?: string; hasAdd?: boolean }
    > = {}
    const addCommandIndexes = new Set<number>()
    const visitForInfos = (obj: any, idx: number) => {
      if (!obj || typeof obj !== "object") return
      // Heuristic: layer object with id/name/type
      if (
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.type === "string"
      ) {
        const key = obj.id as string
        srcInfo[key] = {
          name: obj.name,
          type: obj.type,
          hasAdd: srcInfo[key]?.hasAdd,
        }
      }
      for (const [k, v] of Object.entries(obj)) {
        if (k === "type" && typeof v === "string") {
          const t = v.toLowerCase()
          if (t.includes("add") && typeof (obj as any).layer === "object") {
            const lay = (obj as any).layer
            if (lay && typeof lay.id === "string") {
              const id = lay.id as string
              srcInfo[id] = { name: lay?.name, type: lay?.type, hasAdd: true }
              addCommandIndexes.add(idx)
            }
          }
        }
        if (typeof v === "object" && v) visitForInfos(v, idx)
      }
    }
    for (let i = 0; i < serialized.length; i += 1)
      visitForInfos(serialized[i], i)

    // 4) Build remap table srcId -> targetId
    const remap: Record<string, string> = {}
    const conflicts: ConflictReport = { commitId: source.id, details: [] }
    // collect ids referenced in commands by scanning for string values that match src IDs present in infos or any current id
    const referencedIds = new Set<string>()
    const collectIds = (obj: any) => {
      if (!obj || typeof obj !== "object") return
      for (const v of Object.values(obj)) {
        if (typeof v === "string") {
          if (srcInfo[v] || currentById[v]) referencedIds.add(v)
        } else if (v && typeof v === "object") collectIds(v)
      }
    }
    for (const sc of serialized) collectIds(sc)

    for (const srcId of referencedIds) {
      if (currentById[srcId]) {
        remap[srcId] = srcId
        continue
      }
      const info = srcInfo[srcId]
      if (info?.name && info?.type) {
        const key = `${info.type}::${info.name}`
        if (currentByNameType[key]) {
          remap[srcId] = currentByNameType[key]
          continue
        }
        // No destination with same name/type.
        // If an Add-layer exists in this commit for this id, allow original id (will be created by that add)
        if (info.hasAdd) {
          remap[srcId] = srcId
          continue
        }
        // Cannot create without an add-layer: conflict
        conflicts.details.push({
          path: `layer:${srcId}`,
          reason: "Missing target layer and no add-layer present",
        })
      } else {
        // Unknown layer metadata
        conflicts.details.push({
          path: `layer:${srcId}`,
          reason: "Unknown layer metadata (no name/type)",
        })
      }
    }

    if (conflicts.details.length > 0) return { ok: false, conflicts }

    // 5) Remap serialized commands, and drop add-layer if it would duplicate an existing layer id
    const transform = (obj: any): any => {
      if (!obj || typeof obj !== "object") return obj
      if (Array.isArray(obj)) return obj.map((e) => transform(e))
      const out: any = Array.isArray(obj) ? [] : {}
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && remap[v]) {
          out[k] = remap[v]
        } else if (v && typeof v === "object") {
          out[k] = transform(v)
        } else {
          out[k] = v
        }
      }
      return out
    }

    const transformed: any[] = serialized.map((sc) => transform(sc))

    // Filter add-layer commands that would add an already-existing layer
    const isAddLayer = (sc: any): boolean => {
      if (!sc || typeof sc !== "object") return false
      const t = (sc.type || "").toString().toLowerCase()
      return (
        t.includes("add") &&
        typeof sc.layer === "object" &&
        typeof sc.layer?.id === "string"
      )
    }
    const filtered: any[] = []
    for (const sc of transformed) {
      if (isAddLayer(sc)) {
        const id = sc.layer.id as string
        if (currentById[id]) {
          // Drop duplicate add
          continue
        }
      }
      filtered.push(sc)
    }

    // 6) Deserialize to runtime commands
    const applied: Command[] = []
    for (const sc of filtered) {
      const cmd = this.reviveCommand(sc)
      if (!cmd) {
        return {
          ok: false,
          conflicts: {
            commitId: source.id,
            details: [{ path: "command", reason: "Failed to revive command" }],
          },
        }
      }
      applied.push(cmd)
    }
    return { ok: true, applied }
  }

  // Helpers
  private inverseOf(commit: Commit): Command {
    const prev = this.getState()
    const next = this.applyCommit(commit, prev)
    return commit.commands[0].invert(prev, next)
  }

  private applyCommit(
    commit: Commit,
    state: CanonicalEditorState
  ): CanonicalEditorState {
    let cur = state
    for (const c of commit.commands) cur = c.apply(cur)
    return cur
  }

  private generateId(prefix: string): CommitId {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  private reviveCommand(sc: SerializedCommand | any): Command | null {
    try {
      if (!sc) return null
      if (sc.type === "composite") {
        const children = (sc.commands || [])
          .map((c: any) => this.reviveCommand(c))
          .filter(Boolean) as Command[]
        const cc = new CompositeCommand(
          children,
          sc.meta?.label ?? "Composite",
          sc.meta?.scope ?? "global"
        )
        cc.meta = { ...cc.meta, ...sc.meta }
        return cc
      }
      return deserializeCommand(sc)
    } catch {
      return null
    }
  }
}
