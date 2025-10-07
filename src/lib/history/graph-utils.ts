import type { CommitId, HistoryGraph } from "./types"

export function buildChildrenIndex(
  graph: HistoryGraph
): Record<CommitId, CommitId[]> {
  const children: Record<CommitId, CommitId[]> = {}
  for (const id of Object.keys(graph.commits)) {
    children[id] = []
  }
  for (const commit of Object.values(graph.commits)) {
    for (const pid of commit.parentIds) {
      if (!children[pid]) children[pid] = []
      children[pid].push(commit.id)
    }
  }
  return children
}

export function ancestors(graph: HistoryGraph, start: CommitId): Set<CommitId> {
  const visited = new Set<CommitId>()
  const stack: CommitId[] = [start]
  while (stack.length) {
    const id = stack.pop() as CommitId
    if (visited.has(id)) continue
    visited.add(id)
    const c = graph.commits[id]
    if (c) stack.push(...c.parentIds)
  }
  return visited
}

export function lowestCommonAncestor(
  graph: HistoryGraph,
  a: CommitId,
  b: CommitId
): CommitId | null {
  if (a === b) return a
  const aAnc = ancestors(graph, a)
  // BFS from b upwards to find first in aAnc
  const queue: CommitId[] = [b]
  const seen = new Set<CommitId>()
  while (queue.length) {
    const id = queue.shift() as CommitId
    if (seen.has(id)) continue
    seen.add(id)
    if (aAnc.has(id)) return id
    const parents = graph.commits[id]?.parentIds || []
    for (const p of parents) queue.push(p)
  }
  return null
}

export function pathUpTo(
  graph: HistoryGraph,
  from: CommitId,
  toExclusive: CommitId
): CommitId[] {
  // Walk parents from `from` up to (but not including) `toExclusive`
  const path: CommitId[] = []
  let cur: CommitId | undefined = from
  while (cur && cur !== toExclusive) {
    path.push(cur)
    const parents = graph.commits[cur]?.parentIds || []
    cur = parents[0]
  }
  return path
}

export function pathDown(
  graph: HistoryGraph,
  fromExclusive: CommitId,
  to: CommitId
): CommitId[] {
  // Compute path from LCA to target following unique lineage. Use parent links reversed via children index
  const children = graph.children
  const path: CommitId[] = []
  // Simple DFS to find a path; DAG is small per session
  const stack: Array<{ id: CommitId; path: CommitId[] }> = [
    { id: fromExclusive, path: [] },
  ]
  const visited = new Set<CommitId>()
  while (stack.length) {
    const { id, path: cur } = stack.pop() as { id: CommitId; path: CommitId[] }
    if (visited.has(id)) continue
    visited.add(id)
    for (const ch of children[id] || []) {
      const nextPath = [...cur, ch]
      if (ch === to) return nextPath
      stack.push({ id: ch, path: nextPath })
    }
  }
  return path
}

export function computeDelta(
  graph: HistoryGraph,
  from: CommitId,
  to: CommitId
): { undo: CommitId[]; redo: CommitId[]; lca: CommitId | null } {
  const lca = lowestCommonAncestor(graph, from, to)
  if (!lca) {
    // fall back to undo to root (no parents) then redo down
    const undo = pathUpTo(graph, from, "" as CommitId)
    const redo: CommitId[] = []
    return { undo, redo, lca: null }
  }
  const undo = pathUpTo(graph, from, lca)
  const redo = pathDown(graph, lca, to)
  return { undo, redo, lca }
}

export function isReachableFromHeads(
  graph: HistoryGraph,
  id: CommitId
): boolean {
  // reachable if any branch tip or HEAD can reach id
  const tips = new Set<CommitId>([
    ...Object.values(graph.branches),
    graph.head.at,
  ])
  const visited = new Set<CommitId>()
  const stack = Array.from(tips)
  while (stack.length) {
    const cur = stack.pop() as CommitId
    if (visited.has(cur)) continue
    visited.add(cur)
    if (cur === id) return true
    const c = graph.commits[cur]
    if (c) stack.push(...c.parentIds)
  }
  return false
}
