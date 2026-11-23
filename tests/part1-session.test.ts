import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { copy } from '../src/copy'
import { SESSION_STATUSES } from '../src/domain/types'
import { DEFAULT_GRACE_MINUTES } from '../src/domain/session'
import { CancelTonight } from '../src/screens/Tonight'
import { GuardianSwap } from '../src/screens/GuardianSwap'
import { tonightUntilIso } from '../src/time'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

describe('part 1 tonight session', () => {
  it('stores the plan fields, defaults grace to 10, and starts planned', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput())
    expect(DEFAULT_GRACE_MINUTES).toBe(10)
    expect(session.grace_minutes).toBe(10)
    expect(session.personal_limit_serves).toBe(3)
    expect(session.primary_drink_type).toBe('beer')
    expect(session.share_location).toBe(true)
    expect(session.meds_warning_ack).toBe(false)
    expect(session.guardian_name).toBe('Mei')
    expect(session.guardian_accepted).toBe(false)
    expect(session.status).toBe('planned')
    expect(SESSION_STATUSES).toEqual(['planned', 'active', 'home', 'missed', 'cancelled'])
    expect(Date.parse(session.check_in_at)).toBe(T0 + 3 * 60 * 60 * 1000)
  })

  it('reads a night-out clock time as later tonight, and a passed time as the next morning', () => {
    const now = new Date(2026, 10, 22, 22, 0, 0, 0).getTime()
    const early = new Date(tonightUntilIso('01:43', now))
    expect(early.getDate()).toBe(23)
    expect(early.getHours()).toBe(1)
    expect(early.getMinutes()).toBe(43)
    expect(early.getTime()).toBeGreaterThan(now)
    const later = new Date(tonightUntilIso('23:15', now))
    expect(later.getDate()).toBe(22)
    expect(later.getHours()).toBe(23)
    expect(later.getTime()).toBeGreaterThan(now)
  })

  it('asks before cancelling tonight', () => {
    const ask = renderToStaticMarkup(
      createElement(CancelTonight, {
        pending: false,
        onAsk: () => undefined,
        onConfirm: () => undefined,
        onBack: () => undefined,
      }),
    )
    expect(ask).toContain(`>${copy.cancelTonight}<`)
    expect(ask).not.toContain(copy.confirmCancel)
    const confirm = renderToStaticMarkup(
      createElement(CancelTonight, {
        pending: true,
        onAsk: () => undefined,
        onConfirm: () => undefined,
        onBack: () => undefined,
      }),
    )
    expect(confirm).toContain(`>${copy.confirmCancel}<`)
    expect(confirm).toContain(copy.cancelWarn)
    expect(confirm).toContain(copy.cancelSwap)
    expect(confirm).not.toContain(`>${copy.cancelTonight}<`)
  })

  it('uses an explicit grace and can cancel a session', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput({ grace_minutes: 12, share_location: false }))
    expect(session.grace_minutes).toBe(12)
    expect(session.share_location).toBe(false)
    const cancelled = store.cancel(session.id, T0)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.share_location).toBe(false)
    expect(store.getSnapshot(session.id)?.status).toBe('cancelled')
  })

  it('replaces the guardian only after confirmation and rotates the magic link', () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const session = store.create(sessionInput())
    const proposed = store.proposeGuardian(session.id, 'Lin')
    expect(proposed.guardian_name).toBe('Mei')
    expect(proposed.pending_guardian_name).toBe('Lin')
    expect(proposed.magic_token).toBe(session.magic_token)

    const confirmed = store.confirmGuardian(session.id)
    expect(confirmed.guardian_name).toBe('Lin')
    expect(confirmed.pending_guardian_name).toBeNull()
    expect(confirmed.guardian_accepted).toBe(false)
    expect(confirmed.status).toBe('planned')
    expect(confirmed.magic_token).not.toBe(session.magic_token)
    expect(store.getByToken(session.magic_token)).toBeNull()
    expect(() => store.confirmGuardian(session.id)).toThrow('confirm_required')

    const html = renderToStaticMarkup(
      createElement(GuardianSwap, {
        session: proposed,
        onSession: () => undefined,
        onError: () => undefined,
      }),
    )
    expect(html).toContain(copy.confirmSwapButton)
    expect(html).toContain(copy.cancelSwap)

    store.cancelGuardianChange(store.proposeGuardian(session.id, 'Ada').id)
    expect(store.getSnapshot(session.id)?.guardian_name).toBe('Lin')
    expect(store.getSnapshot(session.id)?.pending_guardian_name).toBeNull()
  })

  it('activates the same session when the second client accepts the magic link', async () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const server = await startApiServer(store)
    try {
      const created = await fetch(`${server.url}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sessionInput()),
      })
      const first = (await created.json()) as { session: { id: string; magic_token: string; status: string } }
      expect(first.session.status).toBe('planned')

      const accepted = await fetch(`${server.url}/api/guardian/${first.session.magic_token}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      expect(accepted.status).toBe(200)
      const guardian = (await accepted.json()) as { view: { status: string; drinker_name: string } }
      const drinker = (await (await fetch(`${server.url}/api/sessions/${first.session.id}`)).json()) as {
        session: { status: string; guardian_accepted: boolean }
      }
      expect(guardian.view.status).toBe('active')
      expect(guardian.view.drinker_name).toBe('Chen')
      expect(drinker.session.status).toBe(guardian.view.status)
      expect(drinker.session.guardian_accepted).toBe(true)
    } finally {
      await server.close()
    }
  })
})
