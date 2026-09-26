import { DomainError } from './errors'
import type { LogEvent, LogKind, LogSource } from './types'

export const UNDO_WINDOW_MS = 30_000

let logSeq = 0

export function drinkTap(): { kind: 'drink'; count: 1; source: 'tap' } {
  return { kind: 'drink', count: 1, source: 'tap' }
}

export function drinkBatch(): { kind: 'drink'; count: 2; source: 'batch' } {
  return { kind: 'drink', count: 2, source: 'batch' }
}

export function waterTap(): { kind: 'water'; count: 1; source: 'tap' } {
  return { kind: 'water', count: 1, source: 'tap' }
}

export function createLogEvent(input: {
  id?: string
  session_id: string
  kind: LogKind
  count: number
  source: LogSource
  created_at: string
}): LogEvent {
  if (!Number.isFinite(input.count) || input.count <= 0) {
    throw new DomainError('count must be positive')
  }
  logSeq += 1
  return {
    id: input.id ?? `log_${logSeq.toString(36)}_${Date.now().toString(36)}`,
    session_id: input.session_id,
    kind: input.kind,
    count: input.count,
    source: input.source,
    undone: false,
    created_at: input.created_at,
  }
}

export function loggedAtLeast(events: LogEvent[]): number {
  return events.reduce((sum, event) => {
    if (event.kind !== 'drink' || event.undone) return sum
    return sum + event.count
  }, 0)
}

export function loggedAtLeastCopy(events: LogEvent[]): string {
  return `Logged at least ${loggedAtLeast(events)}`
}

export function canUndo(event: LogEvent, nowMs: number): boolean {
  if (event.undone) return false
  return nowMs - Date.parse(event.created_at) <= UNDO_WINDOW_MS
}

export function tryUndo(
  events: LogEvent[],
  id: string,
  nowMs: number,
): { ok: boolean; events: LogEvent[] } {
  const current = events.find((event) => event.id === id)
  if (!current || !canUndo(current, nowMs)) return { ok: false, events }
  return {
    ok: true,
    events: events.map((event) => (event.id === id ? { ...event, undone: true } : event)),
  }
}

/** Remaining drinks never lock a night action. */
export function actionsOpen(_personalLimit: number, _logged: number): true {
  return true
}
