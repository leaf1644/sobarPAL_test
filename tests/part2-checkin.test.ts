import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuardianCard } from '../src/screens/GuardianMode'
import { isGuardianAlert } from '../src/domain/alert'
import { createLogEvent, loggedAtLeast } from '../src/domain/log'
import { RETENTION_MS } from '../src/domain/retention'
import { completeFocusRound } from '../src/domain/focusCheck'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

const CHECK_IN = T0 + 3 * 60 * 60 * 1000
const PAST_GRACE = CHECK_IN + 10 * 60 * 1000 + 1000

describe('part 2 I am home and missed check-in', () => {
  it('raises a guardian alert only for an active session past grace that is not home', () => {
    const active = { status: 'active' as const, check_in_at: new Date(CHECK_IN).toISOString(), grace_minutes: 10 }
    const deadline = CHECK_IN + 10 * 60 * 1000
    expect(isGuardianAlert(active, deadline)).toBe(false)
    expect(isGuardianAlert(active, deadline + 1)).toBe(true)
    expect(isGuardianAlert({ ...active, status: 'home' }, deadline + 1)).toBe(false)
    expect(isGuardianAlert({ ...active, status: 'planned' }, deadline + 1)).toBe(false)
    expect(isGuardianAlert({ ...active, status: 'missed' }, deadline + 1)).toBe(false)
    expect(isGuardianAlert({ ...active, status: 'cancelled' }, deadline + 1)).toBe(false)

    const drinks = [
      createLogEvent({
        session_id: 'ses',
        kind: 'drink',
        count: 8,
        source: 'tap',
        created_at: new Date(T0).toISOString(),
      }),
    ]
    expect(loggedAtLeast(drinks)).toBe(8)
    expect(isGuardianAlert(active, CHECK_IN)).toBe(false)
    expect(completeFocusRound({ game: 'match', correct: false }).passed).toBeNull()
    expect(isGuardianAlert(active, deadline + 1)).toBe(true)
  })

  it('marks a closed drinker client missed, reminds at most every 20 minutes, and stops sharing at home', async () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const server = await startApiServer(store)
    try {
      const created = await postJson(`${server.url}/api/sessions`, sessionInput())
      const id = created.session.id as string
      const token = created.session.magic_token as string
      await postJson(`${server.url}/api/guardian/${token}/accept`, {})
      await postJson(`${server.url}/api/sessions/${id}/ping`, { label: 'MTR exit B' })
      await postJson(`${server.url}/api/sessions/${id}/ping`, { label: 'Taxi rank' })

      const before = store.getSnapshot(id)
      expect(before?.last_ping?.label).toBe('Taxi rank')
      expect(JSON.stringify(before)).not.toContain('trail')
      expect(before?.status).toBe('active')

      await postJson(`${server.url}/api/demo/advance`, { minutes: 191 })
      const guardian = (await (await fetch(`${server.url}/api/guardian/${token}`)).json()) as {
        view: {
          status: string
          drinker_name: string
          check_in_status: string
          call_label: string
          last_ping: { label: string } | null
          needs_check_in_followup: boolean
        }
      }
      expect(guardian.view.status).toBe('missed')
      expect(guardian.view.drinker_name).toBe('Chen')
      expect(guardian.view.check_in_status).toBe('錯過回報')
      expect(guardian.view.call_label).toBe('打電話給Chen')
      expect(guardian.view.needs_check_in_followup).toBe(true)
      expect(guardian.view.last_ping?.label).toBe('Taxi rank')
      expect(JSON.stringify(guardian.view)).not.toContain('personal_limit_serves')
      expect(JSON.stringify(guardian.view)).not.toContain('primary_drink')

      const drinker = (await (await fetch(`${server.url}/api/sessions/${id}`)).json()) as {
        session: { needs_ok_prompt: boolean; status: string }
      }
      expect(drinker.session.needs_ok_prompt).toBe(true)
      expect(drinker.session.status).toBe('missed')

      const home = await postJson(`${server.url}/api/sessions/${id}/home`, {})
      expect(home.session.status).toBe('home')
      expect(home.session.share_location).toBe(false)
      expect(home.session.needs_ok_prompt).toBe(false)
      const after = (await (await fetch(`${server.url}/api/guardian/${token}`)).json()) as {
        view: { status: string; last_ping: unknown }
      }
      expect(after.view.status).toBe('home')
      expect(after.view.last_ping).toBeNull()
    } finally {
      await server.close()
    }
  })

  it('fires the watchdog without a drinker poll and spaces reminders by 20 minutes', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput(), T0)
    store.acceptByToken(session.magic_token)
    const deadline = CHECK_IN + 10 * 60 * 1000
    expect(store.watchdogTick(deadline).missedIds).not.toContain(session.id)
    const first = store.watchdogTick(deadline + 1)
    expect(first.missedIds).toContain(session.id)
    expect(first.remindedIds).not.toContain(session.id)
    expect(store.getSnapshot(session.id)?.needs_ok_prompt).toBe(true)
    expect(store.watchdogTick(deadline + 1).missedIds).not.toContain(session.id)

    expect(store.watchdogTick(deadline + 1 + 20 * 60 * 1000 - 1).remindedIds).not.toContain(session.id)
    expect(store.watchdogTick(deadline + 1 + 20 * 60 * 1000).remindedIds).toContain(session.id)
    expect(store.watchdogTick(deadline + 1 + 20 * 60 * 1000).remindedIds).not.toContain(session.id)
    expect(store.getSnapshot(session.id)?.needs_ok_prompt).toBe(true)
  })

  it('shows the same miss on the replacement magic link', async () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const server = await startApiServer(store)
    try {
      const created = await postJson(`${server.url}/api/sessions`, sessionInput())
      const id = created.session.id as string
      const oldToken = created.session.magic_token as string
      await postJson(`${server.url}/api/guardian/${oldToken}/accept`, {})
      await postJson(`${server.url}/api/demo/advance`, { minutes: 191 })

      const missed = (await (await fetch(`${server.url}/api/sessions/${id}`)).json()) as {
        session: { status: string; needs_ok_prompt: boolean }
      }
      expect(missed.session.status).toBe('missed')
      expect(missed.session.needs_ok_prompt).toBe(true)

      await postJson(`${server.url}/api/sessions/${id}/guardian/propose`, { guardian_name: 'Lin' })
      const confirmed = await postJson(`${server.url}/api/sessions/${id}/guardian/confirm`, {})
      const newToken = confirmed.session.magic_token as string
      expect(confirmed.session.status).toBe('missed')
      expect(confirmed.session.needs_ok_prompt).toBe(true)
      expect(newToken).not.toBe(oldToken)
      expect((await fetch(`${server.url}/api/guardian/${oldToken}`)).status).toBe(404)

      const opened = (await (await fetch(`${server.url}/api/guardian/${newToken}`)).json()) as {
        view: { status: string; needs_check_in_followup: boolean; drinker_name: string }
      }
      expect(opened.view.status).toBe('missed')
      expect(opened.view.needs_check_in_followup).toBe(true)
      expect(opened.view.drinker_name).toBe('Chen')

      const accepted = await fetch(`${server.url}/api/guardian/${newToken}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      const acceptedBody = (await accepted.json()) as { view: { status: string } }
      expect(accepted.status).toBe(200)
      expect(acceptedBody.view.status).toBe('missed')
      const drinker = (await (await fetch(`${server.url}/api/sessions/${id}`)).json()) as {
        session: { status: string; needs_ok_prompt: boolean }
      }
      expect(drinker.session.status).toBe('missed')
      expect(drinker.session.needs_ok_prompt).toBe(true)
    } finally {
      await server.close()
    }
  })

  it('keeps the missed check-in when the guardian is replaced', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput(), T0)
    store.acceptByToken(session.magic_token)
    store.recordPing(session.id, 'Taxi rank', T0)
    store.watchdogTick(PAST_GRACE)
    expect(store.getSnapshot(session.id)?.needs_ok_prompt).toBe(true)

    store.proposeGuardian(session.id, 'Lin')
    const confirmed = store.confirmGuardian(session.id)
    expect(confirmed.status).toBe('missed')
    expect(confirmed.needs_ok_prompt).toBe(true)
    expect(confirmed.guardian_name).toBe('Lin')
    expect(confirmed.guardian_accepted).toBe(false)
    expect(store.getByToken(session.magic_token)).toBeNull()

    const beforeAccept = store.guardianView(confirmed.magic_token)
    expect(beforeAccept.status).toBe('missed')
    expect(beforeAccept.needs_check_in_followup).toBe(true)
    expect(beforeAccept.drinker_name).toBe('Chen')

    const accepted = store.acceptByToken(confirmed.magic_token)
    expect(accepted.status).toBe('missed')
    expect(accepted.needs_ok_prompt).toBe(true)
    expect(accepted.guardian_accepted).toBe(true)
    const afterAccept = store.guardianView(confirmed.magic_token)
    expect(afterAccept.status).toBe('missed')
    expect(afterAccept.last_ping?.label).toBe('Taxi rank')
  })

  it('renders Accept on a missed replacement link until the new guardian attaches', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput(), T0)
    store.acceptByToken(session.magic_token)
    store.recordPing(session.id, 'Taxi rank', T0)
    store.watchdogTick(PAST_GRACE)
    store.proposeGuardian(session.id, 'Lin')
    const confirmed = store.confirmGuardian(session.id)
    const invite = store.guardianView(confirmed.magic_token)
    const before = renderToStaticMarkup(
      createElement(GuardianCard, {
        view: invite,
        calling: false,
        onCall: () => undefined,
        onAccept: () => undefined,
      }),
    )
    expect(before).toContain('>接受<')
    expect(before).toContain('錯過回報')
    expect(before).not.toContain('Taxi rank')

    const accepted = store.acceptByToken(confirmed.magic_token)
    expect(accepted.status).toBe('missed')
    expect(accepted.needs_ok_prompt).toBe(true)
    const attached = store.guardianView(confirmed.magic_token)
    const after = renderToStaticMarkup(
      createElement(GuardianCard, {
        view: attached,
        calling: false,
        onCall: () => undefined,
        onAccept: () => undefined,
      }),
    )
    expect(after).not.toContain('>接受<')
    expect(after).toContain('Taxi rank')
    expect(after).toContain('錯過回報')
  })

  it('does not miss a session the guardian never accepted', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput(), T0)
    expect(store.watchdogTick(PAST_GRACE).missedIds).not.toContain(session.id)
    expect(store.getSnapshot(session.id)?.status).toBe('planned')
  })

  it('removes session artefacts 7 days after they were created', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const oldSession = store.create(sessionInput({ drinker_name: 'Old' }), T0)
    const young = store.create(
      sessionInput({ drinker_name: 'Young', guardian_name: 'Ada' }),
      T0 + 2 * 24 * 60 * 60 * 1000,
    )
    expect(store.watchdogTick(T0 + RETENTION_MS - 1).purgedIds).not.toContain(oldSession.id)
    const purged = store.watchdogTick(T0 + RETENTION_MS)
    expect(purged.purgedIds).toContain(oldSession.id)
    expect(store.getSnapshot(oldSession.id)).toBeNull()
    expect(store.getSnapshot(young.id)?.drinker_name).toBe('Young')
  })

  it('does not read a location trail or a camera from the app source', () => {
    const source = readSrc()
    expect(source).not.toContain('geolocation')
    expect(source).not.toContain('getUserMedia')
    expect(source).not.toContain('eBAC')
  })
})

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as { session: Record<string, unknown>; error?: string }
  expect(response.status, payload.error).toBe(200)
  return payload
}

function readSrc(): string {
  const root = join(process.cwd(), 'src')
  return walk(root)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
