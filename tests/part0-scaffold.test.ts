import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'
import { copy, loggedLine } from '../src/copy'
import { memoryStorage, createSparseLog } from '../src/client/sparseLog'
import { magicLinkFromPage, parseHash } from '../src/route'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

describe('part 0 scaffold', () => {
  it('renders the three modes and the tonight actions from the app shell', () => {
    const plan = renderToStaticMarkup(createElement(App))
    expect(plan).toContain(copy.navPlan)
    expect(plan).toContain(copy.navTonight)
    expect(plan).toContain(copy.navGuardian)
    expect(plan).toContain(`class="theme-switch">${copy.themeToLight}`)
    expect(plan).not.toContain(`class="theme-switch">${copy.themeToDark}`)
    expect(plan).toContain(copy.tagline)
    expect(plan).not.toContain('人照看人')

    const light = renderToStaticMarkup(createElement(App, { initialTheme: 'light' }))
    expect(light).toContain(`class="theme-switch">${copy.themeToDark}`)
    expect(light).toContain(copy.navPlan)
    expect(light).toContain(copy.navTonight)
    expect(light).toContain(copy.navGuardian)
    expect(light).not.toContain('人照看人')

    const tonight = renderToStaticMarkup(createElement(App, { initialHash: '#/tonight' }))
    expect(tonight).toContain(`>${copy.navTonight}<`)
    expect(tonight).toContain(copy.drinkOne)
    expect(tonight).toContain(copy.drinkTwo)
    expect(tonight).toContain(copy.focus)
    expect(tonight).toContain(copy.home)
    expect(tonight).toContain(copy.water)
    expect(tonight).not.toContain('人照看人')
  })

  it('parses a guardian magic link for the second computer', () => {
    expect(parseHash('#/plan')).toEqual({ name: 'plan' })
    expect(parseHash('#/tonight/ses_1')).toEqual({ name: 'tonight', id: 'ses_1' })
    expect(parseHash('#/guardian')).toEqual({ name: 'guardian' })
    expect(parseHash('#/g/tok_abc')).toEqual({ name: 'guardian-session', token: 'tok_abc' })
    expect(magicLinkFromPage('http://10.0.0.8:5173/', 'tok_abc')).toBe('http://10.0.0.8:5173/#/g/tok_abc')
  })

  it('shares one session across two readers, and keeps the drink log off that session', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const created = store.create(sessionInput())
    const second = store.getByToken(created.magic_token)
    expect(second?.id).toBe(created.id)
    expect(second?.status).toBe('planned')
    expect(JSON.stringify(second)).not.toContain('"kind"')

    const log = createSparseLog(memoryStorage(), created.id)
    log.add({ kind: 'drink', count: 1, source: 'tap', now: T0 })
    expect(log.list()).toHaveLength(1)
    expect(log.copy()).toBe(loggedLine(1))
    expect(JSON.stringify(store.getSnapshot(created.id))).not.toContain('"kind":"drink"')
  })

  it('reloads the same session from the shared backend file in a second store', () => {
    const dir = mkdtempSync(join(tmpdir(), 'soberpal-'))
    const path = join(dir, 'sessions.json')
    try {
      const first = createSessionStore({ persistPath: path, clock: fixedClock(T0) })
      const created = first.create(sessionInput())
      const second = createSessionStore({ persistPath: path, clock: fixedClock(T0) })
      expect(second.getByToken(created.magic_token)?.id).toBe(created.id)
      expect(second.getSnapshot(created.id)?.drinker_name).toBe('Chen')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('lets a second HTTP client read the session the first client created', async () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const server = await startApiServer(store)
    try {
      const created = await fetch(`${server.url}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sessionInput()),
      })
      expect(created.status).toBe(200)
      const body = (await created.json()) as { session: { id: string; magic_token: string; status: string } }
      const guardian = await fetch(`${server.url}/api/guardian/${body.session.magic_token}`)
      expect(guardian.status).toBe(200)
      const view = (await guardian.json()) as { view: { drinker_name: string; status: string } }
      expect(view.view.drinker_name).toBe('Chen')
      expect(view.view.status).toBe(body.session.status)
      const again = await fetch(`${server.url}/api/sessions/${body.session.id}`)
      const drinker = (await again.json()) as { session: { status: string } }
      expect(drinker.session.status).toBe(view.view.status)
    } finally {
      await server.close()
    }
  })

  it('mounts the thin backend from the Vite config', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    expect(config).toContain('soberpalApiPlugin')
    expect(config).toContain("port: 5173")
  })
})
