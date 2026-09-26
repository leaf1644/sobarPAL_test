import { DomainError } from './errors'
import type { LogEvent, LogKind, LogSource } from './types'

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
    throw new DomainError('count_positive')
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

export type LogGroup = {
  kind: 'drink' | 'water'
  total: number
  latestId: string
}

/** One line per drink or water, summing every cup that has not been undone. */
export function groupedVisibleLogs(events: LogEvent[]): LogGroup[] {
  return (['drink', 'water'] as const).flatMap((kind) => {
    const active = events.filter((event) => event.kind === kind && !event.undone)
    if (active.length === 0) return []
    return [
      {
        kind,
        total: active.reduce((sum, event) => sum + event.count, 0),
        latestId: active[active.length - 1].id,
      },
    ]
  })
}

export function canUndo(event: LogEvent): boolean {
  return !event.undone && event.count > 0
}

export function tryUndo(events: LogEvent[], id: string): { ok: boolean; events: LogEvent[] } {
  const current = events.find((event) => event.id === id)
  if (!current || !canUndo(current)) return { ok: false, events }
  return {
    ok: true,
    events: events.map((event) => {
      if (event.id !== id) return event
      if (event.count > 1) return { ...event, count: event.count - 1 }
      return { ...event, undone: true }
    }),
  }
}
