import { describe, expect, it } from 'vitest'
import { isGuardianAlert } from '../src/domain/alert'
import { loggedAtLeast, createLogEvent } from '../src/domain/log'
import { evaluateNudges, evaluateSessionNudges, nudgeCopy, WATER_NUDGE_GAP_MS, NUDGE_MIN_GAP_MS, HEADING_HOME_BEFORE_MS } from '../src/domain/nudge'
import { emptyNudgePolicy } from '../src/domain/session'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

const CHECK_IN = T0 + 3 * 60 * 60 * 1000
const HEADING = CHECK_IN - HEADING_HOME_BEFORE_MS

describe('part 4 session watch nudges', () => {
  it('caps water at 45 minutes, heading-home at one, and any nudge at 30 minutes', () => {
    const early = activeAt()
    expect(evaluateSessionNudges(early.session, T0)).toBe('water')
    expect(nudgeCopy('water')).toBe('Time for water?')
    expect(nudgeCopy('heading_home')).toBe('heading home?')

    early.store.noteNudge(early.session.id, 'water', T0)
    const noted = early.store.getSnapshot(early.session.id)!
    expect(evaluateSessionNudges(noted, T0 + WATER_NUDGE_GAP_MS - 60_000)).toBeNull()
    expect(evaluateSessionNudges(noted, T0 + WATER_NUDGE_GAP_MS + 60_000)).toBe('water')
    expect(noted.status).toBe('active')
    expect(isGuardianAlert(noted, T0 + WATER_NUDGE_GAP_MS)).toBe(false)

    const blocked = activeAt()
    blocked.store.noteNudge(blocked.session.id, 'water', HEADING - 10 * 60 * 1000)
    expect(evaluateSessionNudges(blocked.store.getSnapshot(blocked.session.id)!, HEADING)).toBeNull()

    const allowed = activeAt()
    allowed.store.noteNudge(allowed.session.id, 'water', HEADING - NUDGE_MIN_GAP_MS)
    expect(evaluateSessionNudges(allowed.store.getSnapshot(allowed.session.id)!, HEADING)).toBe('heading_home')
    allowed.store.noteNudge(allowed.session.id, 'heading_home', HEADING)
    expect(evaluateSessionNudges(allowed.store.getSnapshot(allowed.session.id)!, HEADING + 1000)).toBeNull()

    const quiet = activeAt()
    quiet.store.dismissNudges(quiet.session.id)
    expect(evaluateSessionNudges(quiet.store.getSnapshot(quiet.session.id)!, T0)).toBeNull()
    expect(quiet.store.getSnapshot(quiet.session.id)?.status).toBe('active')
  })

  it('ignores drink totals and focus results, and stays quiet unless the session is active', () => {
    const { session } = activeAt()
    const drinks = [
      createLogEvent({
        session_id: session.id,
        kind: 'drink',
        count: 9,
        source: 'batch',
        created_at: new Date(T0).toISOString(),
      }),
    ]
    expect(loggedAtLeast(drinks)).toBe(9)
    const nudge = evaluateSessionNudges(session, T0)
    expect(nudge).toBe('water')
    expect(evaluateNudges({
      now: T0,
      check_in_at: CHECK_IN,
      status: 'planned',
      policy: {
        dismissed_for_tonight: false,
        last_water_nudge_at: null,
        heading_home_sent: false,
        last_nudge_at: null,
      },
    })).toBeNull()
    expect(evaluateNudges({
      now: CHECK_IN,
      check_in_at: CHECK_IN,
      status: 'active',
      policy: {
        dismissed_for_tonight: false,
        last_water_nudge_at: null,
        heading_home_sent: false,
        last_nudge_at: null,
      },
    })).toBe('heading_home')
    expect(evaluateNudges({
      now: CHECK_IN,
      check_in_at: CHECK_IN,
      status: 'active',
      policy: {
        dismissed_for_tonight: false,
        last_water_nudge_at: null,
        heading_home_sent: true,
        last_nudge_at: CHECK_IN,
      },
    })).toBeNull()
    const result = evaluateNudges({
      now: T0,
      check_in_at: CHECK_IN,
      status: 'active',
      policy: {
        dismissed_for_tonight: false,
        last_water_nudge_at: null,
        heading_home_sent: false,
        last_nudge_at: null,
      },
    })
    expect(result).not.toBeInstanceOf(Promise)
    expect(isGuardianAlert(session, T0)).toBe(false)
  })

  it('asks heading home once on a two-hour night and on 15-minute jumps', () => {
    const twoHours = 2 * 60 * 60 * 1000
    for (const step of [60_000, 15 * 60 * 1000]) {
      const seen = collectNudges(twoHours, step)
      expect(seen.filter((item) => item.kind === 'heading_home')).toHaveLength(1)
      const waters = seen.filter((item) => item.kind === 'water')
      for (let index = 1; index < seen.length; index += 1) {
        expect(seen[index].at - seen[index - 1].at).toBeGreaterThanOrEqual(NUDGE_MIN_GAP_MS)
      }
      for (let index = 1; index < waters.length; index += 1) {
        expect(waters[index].at - waters[index - 1].at).toBeGreaterThanOrEqual(WATER_NUDGE_GAP_MS)
      }
    }
  })

  it('does not call a model while deciding a nudge', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/domain/nudge.ts', import.meta.url), 'utf8'))
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('openai')
    expect(emptyNudgePolicy().dismissed_for_tonight).toBe(false)
  })
})

function collectNudges(horizonMs: number, stepMs: number) {
  const store = createSessionStore({ clock: fixedClock(T0) })
  const created = store.create(
    sessionInput({ check_in_at: new Date(T0 + horizonMs).toISOString() }),
    T0,
  )
  store.acceptByToken(created.magic_token)
  const seen: { at: number; kind: string }[] = []
  for (let now = T0; now <= T0 + horizonMs + 15 * 60 * 1000; now += stepMs) {
    const snap = store.getSnapshot(created.id)
    if (!snap) break
    const kind = evaluateSessionNudges(snap, now)
    if (!kind) continue
    seen.push({ at: now, kind })
    store.noteNudge(created.id, kind, now)
  }
  return seen
}

function activeAt() {
  const store = createSessionStore({ clock: fixedClock(T0) })
  const created = store.create(sessionInput(), T0)
  store.acceptByToken(created.magic_token)
  const session = store.getSnapshot(created.id)!
  return { store, session }
}
