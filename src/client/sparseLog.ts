import { createLogEvent, loggedAtLeastCopy, tryUndo } from '../domain/log'
import type { LogEvent, LogKind, LogSource } from '../domain/types'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function createSparseLog(storage: StorageLike, sessionId: string) {
  const key = `soberpal.logs.${sessionId}`

  function read(): LogEvent[] {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LogEvent[]
    return Array.isArray(parsed) ? parsed : []
  }

  function write(events: LogEvent[]) {
    storage.setItem(key, JSON.stringify(events))
  }

  return {
    list: read,
    add(input: { kind: LogKind; count: number; source: LogSource; now: number }) {
      const events = read()
      events.push(
        createLogEvent({
          session_id: sessionId,
          kind: input.kind,
          count: input.count,
          source: input.source,
          created_at: new Date(input.now).toISOString(),
        }),
      )
      write(events)
      return events
    },
    undo(id: string, now: number) {
      const result = tryUndo(read(), id, now)
      if (result.ok) write(result.events)
      return result
    },
    clear() {
      storage.removeItem(key)
    },
    copy() {
      return loggedAtLeastCopy(read())
    },
  }
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => {
      map.delete(key)
    },
  }
}
