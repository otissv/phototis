// LRU memoization cache with time-bucket coalescing for scrubbing

type CacheKey = string

export type MemoKeyParts = {
  layerId: string
  toolId: string
  paramId: string
  tBucket: number // coalesced time bucket
  revision: number // track revision counter
}

export function makeKey(parts: MemoKeyParts): CacheKey {
  return `${parts.layerId}|${parts.toolId}|${parts.paramId}|${parts.tBucket}|${parts.revision}`
}

export class LruCache<V> {
  private map = new Map<CacheKey, V>()
  private order: CacheKey[] = []
  constructor(private maxSize: number) {}

  get(key: CacheKey): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) this.touch(key)
    return v
  }

  set(key: CacheKey, value: V): void {
    if (this.map.has(key)) {
      this.map.set(key, value)
      this.touch(key)
      return
    }
    this.map.set(key, value)
    this.order.push(key)
    this.evictIfNeeded()
  }

  invalidate(predicate: (key: CacheKey) => boolean): void {
    const remaining: CacheKey[] = []
    for (const k of this.order) {
      if (predicate(k)) {
        this.map.delete(k)
      } else {
        remaining.push(k)
      }
    }
    this.order = remaining
  }

  clear(): void {
    this.map.clear()
    this.order.length = 0
  }

  private touch(key: CacheKey): void {
    const idx = this.order.indexOf(key)
    if (idx >= 0) {
      this.order.splice(idx, 1)
      this.order.push(key)
    }
  }

  private evictIfNeeded(): void {
    while (this.order.length > this.maxSize) {
      const oldest = this.order.shift()
      if (oldest) this.map.delete(oldest)
    }
  }
}

export function toTimeBucket(t: number, bucketMs = 8): number {
  // Convert seconds to ms and bucket
  const ms = Math.max(0, Math.floor(t * 1000))
  return Math.floor(ms / bucketMs)
}
