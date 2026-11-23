import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'
import { copy, loggedLine } from '../src/copy'
import { createSparseLog, memoryStorage } from '../src/client/sparseLog'
import {
  canUndo,
  createLogEvent,
  drinkBatch,
  drinkTap,
  groupedVisibleLogs,
  loggedAtLeast,
  tryUndo,
  waterTap,
} from '../src/domain/log'
import { LOG_KINDS, LOG_SOURCES, type LogEvent } from '../src/domain/types'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

describe('part 3 sparse drink log', () => {
  it('groups drinks and water, and undoes one cup at a time', () => {
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
    expect(loggedLine(loggedAtLeast(events))).toBe(loggedLine(3))

    expect(groupedVisibleLogs(events)).toEqual([
      { kind: 'drink', total: 3, latestId: events[1].id },
      { kind: 'water', total: 1, latestId: events[2].id },
    ])

    const once = log.undo(events[1].id)
    expect(once.ok).toBe(true)
    expect(once.events[1].count).toBe(1)
    expect(once.events[1].undone).toBe(false)
    expect(loggedAtLeast(once.events)).toBe(2)
    expect(groupedVisibleLogs(once.events)[0]).toEqual({ kind: 'drink', total: 2, latestId: events[1].id })

    const twice = tryUndo(once.events, events[1].id)
    expect(twice.ok).toBe(true)
    expect(twice.events[1].undone).toBe(true)
    expect(canUndo(twice.events[1])).toBe(false)
    expect(loggedAtLeast(twice.events)).toBe(1)
    const cleared = tryUndo(twice.events, events[0].id)
    expect(cleared.ok).toBe(true)
    expect(loggedAtLeast(cleared.events)).toBe(0)
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
    expect(html).toContain(loggedLine(0))
    expect(html).toContain(copy.drinkOne)
    expect(html).toContain(copy.home)
    expect(html).not.toContain('disabled')
    expect(html).not.toContain('人照看人')
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
    expect(loggedLine(loggedAtLeast(sample))).toBe(loggedLine(2))
    expect(loggedLine(2)).toContain('冇撳')
    expect(loggedLine(2)).not.toContain('至少記低咗')
  })
})
