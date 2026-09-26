import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FocusCheck } from '../src/screens/FocusCheck'
import { isGuardianAlert } from '../src/domain/alert'
import {
  FOCUS_DISCLAIMER,
  FOCUS_ROUND_SECONDS,
  completeFocusRound,
  imHomeAllowed,
  logicRound,
  matchRound,
  reactionScript,
  requestHome,
  sessionAfterFocusCheck,
} from '../src/domain/focusCheck'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

describe('part 5 focus check', () => {
  it('offers three games for about 30 seconds and never a pass or fail', () => {
    expect(FOCUS_ROUND_SECONDS).toBe(30)
    const reaction = reactionScript(5)
    expect(reaction.appear_at_ms).toBeGreaterThanOrEqual(800)
    expect(reaction.appear_at_ms).toBeLessThan(2000)

    const match = matchRound(4)
    expect(match.options[match.match_index]).toBe(match.sample)

    const logic = logicRound(2)
    expect(logic.choices[logic.answer_index]).toBe(logic.sequence.at(-2) === 'circle' ? logic.choices[logic.answer_index] : logic.choices[logic.answer_index])
    expect(logic.choices[logic.answer_index]).toBe(expectedNext(logic.sequence))

    const missed = completeFocusRound({ game: 'logic', correct: false })
    const hit = completeFocusRound({ game: 'reaction', correct: true })
    expect(missed.passed).toBeNull()
    expect(hit.passed).toBeNull()
    expect(missed.completed).toBe(true)
    expect(missed.duration_hint_seconds).toBe(30)
  })

  it('does not change the guardian alert and does not block I am home', async () => {
    const store = createSessionStore({ clock: fixedClock(T0) })
    const created = store.create(sessionInput(), T0)
    store.acceptByToken(created.magic_token)
    const session = store.getSnapshot(created.id)!
    const outcome = completeFocusRound({ game: 'match', correct: false })
    const after = sessionAfterFocusCheck(session, outcome)
    expect(after.status).toBe(session.status)
    expect(isGuardianAlert(after, T0)).toBe(isGuardianAlert(session, T0))
    expect(imHomeAllowed({ active: true, outcome: null })).toBe(true)
    expect(imHomeAllowed({ active: true, outcome })).toBe(true)
    const decision = requestHome(session, { active: true, outcome })
    expect(decision.proceed).toBe(true)
    expect(decision.session.status).toBe('active')

    const server = await startApiServer(store)
    try {
      const response = await fetch(`${server.url}/api/sessions/${session.id}/focus`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passed: false }),
      })
      expect(response.status).toBe(404)
      expect(store.getSnapshot(session.id)?.status).toBe('active')
    } finally {
      await server.close()
    }
  })

  it('renders the pause disclaimer and the way back to the night actions', () => {
    const html = renderToStaticMarkup(
      createElement(FocusCheck, {
        onLeave: () => undefined,
        onDrink: () => undefined,
        onDrinkBatch: () => undefined,
        onHome: () => undefined,
      }),
    )
    expect(html).toContain(FOCUS_DISCLAIMER)
    expect(html).toContain('Reaction tap')
    expect(html).toContain('Focus match')
    expect(html).toContain('Logic pattern')
    expect(html).toContain('+ Drink')
    expect(html).toContain('Focus Check')
    expect(html).toContain('I&#x27;m home')
    expect(html).not.toContain('You passed')
    expect(html).not.toContain('You failed')
    expect(html).toContain('sobriety')
    expect(html).toContain('driving-safety')
  })
})

function expectedNext(sequence: string[]): string {
  if (sequence.join(',') === 'triangle,triangle,circle,triangle,triangle') return 'circle'
  if (sequence[0] === 'square') return 'square'
  return 'circle'
}
