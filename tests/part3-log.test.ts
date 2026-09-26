import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'
import { createSparseLog, memoryStorage } from '../src/client/sparseLog'
import {
  actionsOpen,
  canUndo,
  createLogEvent,
  drinkBatch,
  drinkTap,
  loggedAtLeast,
  loggedAtLeastCopy,
  tryUndo,
  UNDO_WINDOW_MS,
  waterTap,
} from '../src/domain/log'
import { LOG_KINDS, LOG_SOURCES, type LogEvent } from '../src/domain/types'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

describe('part 3 sparse drink log', () => {
  it('logs a drink, a batch of two, and water, then undoes only inside 30 seconds', () => {
    const storage = memoryStorage()
    const log = createSparseLog(storage, 'ses_1')
    const tap = drinkTap()
    const batch = drinkBatch()
    const water = waterTap()
    expect(tap).toEqual({ kind: 'drink', count: 1, source: 'tap' })
    expect(batch).toEqual({ kind: 'drink', count: 2, source: 'batch' })
    expect(water).toEqual({ kind: 'water', count: 1, source: 'tap' })

    let events = log.add({ ...tap, now: T0 })
    events = log.add({ ...batch, now: T0 + 1000 })
    events = log.add({ ...water, now: T0 + 2000 })
    events = log.add({ kind: 'extend', count: 1, source: 'widget', now: T0 + 3000 })
    events = log.add({ kind: 'pause', count: 1, source: 'watch', now: T0 + 4000 })
    expect(loggedAtLeast(events)).toBe(3)
    expect(loggedAtLeastCopy(events)).toBe('至少記了 3 杯')

    const drinkId = events[0].id
    const undone = log.undo(drinkId, T0 + UNDO_WINDOW_MS)
    expect(undone.ok).toBe(true)
    expect(loggedAtLeast(undone.events)).toBe(2)
    expect(canUndo(undone.events[0], T0 + UNDO_WINDOW_MS + 1)).toBe(false)

    const late = tryUndo(undone.events, events[1].id, T0 + 1000 + UNDO_WINDOW_MS + 1)
    expect(late.ok).toBe(false)
    expect(loggedAtLeast(late.events)).toBe(2)
    expect(actionsOpen(1, loggedAtLeast(late.events))).toBe(true)
    expect(LOG_KINDS).toEqual(['drink', 'water', 'pause', 'home', 'extend'])
    expect(LOG_SOURCES).toEqual(['tap', 'widget', 'batch', 'watch'])
    expect(events.every((event) => event.session_id === 'ses_1')).toBe(true)
    expect(storage.getItem('soberpal.logs.ses_1')).toContain('"source":"widget"')
  })

  it('keeps the drink log in browser storage and refuses a drink route on the backend', async () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const created = store.create(sessionInput(), T0)
    const log = createSparseLog(memoryStorage(), created.id)
    log.add({ ...drinkBatch(), now: T0 })
    expect(loggedAtLeast(log.list())).toBe(2)
    expect(store.getSnapshot(created.id)?.status).toBe('planned')

    const server = await startApiServer(store)
    try {
      const response = await fetch(`${server.url}/api/sessions/${created.id}/drinks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count: 4 }),
      })
      expect(response.status).toBe(404)
      const smuggled = await fetch(`${server.url}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...sessionInput(), logs: [{ kind: 'drink', count: 9 }] }),
      })
      const body = (await smuggled.json()) as { session: { status: string } }
      expect(smuggled.status).toBe(200)
      expect(body.session.status).toBe('planned')
      expect(JSON.stringify(body.session)).not.toContain('"logs"')
    } finally {
      await server.close()
    }
  })

  it('shows at least N and does not describe a complete intake', () => {
    const html = renderToStaticMarkup(createElement(App, { initialHash: '#/tonight' }))
    expect(html).toContain('至少記了 0 杯')
    expect(html).toContain('不是完整紀錄')
    expect(html.toLowerCase()).not.toContain('total drinks')
    expect(html.toLowerCase()).not.toContain('complete intake')
    const sample: LogEvent[] = [
      createLogEvent({
        session_id: 's',
        kind: 'drink',
        count: 2,
        source: 'batch',
        created_at: new Date(T0).toISOString(),
      }),
    ]
    expect(loggedAtLeastCopy(sample)).toBe('至少記了 2 杯')
  })
})
