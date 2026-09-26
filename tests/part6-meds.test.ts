import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'
import { copy } from '../src/copy'
import { MEDS_WARNINGS, REFUSAL_SCRIPTS, medsForSurface, storeMedsAck } from '../src/domain/meds'
import { startApiServer } from '../src/server/api'
import { fixedClock } from '../src/server/clock'
import { createSessionStore } from '../src/server/sessionStore'
import { sessionInput, T0 } from './helpers'

describe('part 6 meds warning', () => {
  it('shows static warnings only while planning and stores the ack only after confirm', async () => {
    expect(storeMedsAck(false)).toBe(false)
    expect(storeMedsAck(true)).toBe(true)
    expect(medsForSurface('plan').warnings).toEqual(MEDS_WARNINGS)
    expect(medsForSurface('plan').scripts).toEqual(REFUSAL_SCRIPTS)
    expect(medsForSurface('tonight')).toEqual({ warnings: [], scripts: [] })
    expect(MEDS_WARNINGS.length).toBeGreaterThan(0)
    expect(REFUSAL_SCRIPTS.length).toBeGreaterThan(0)

    const store = createSessionStore({ clock: fixedClock(T0) })
    expect(store.create(sessionInput({ meds_confirmed: false }), T0).meds_warning_ack).toBe(false)
    expect(store.create(sessionInput({ meds_confirmed: true, drinker_name: 'Lin' }), T0).meds_warning_ack).toBe(true)

    const server = await startApiServer(store)
    try {
      const response = await fetch(`${server.url}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...sessionInput({ drinker_name: 'Wui' }), meds_warning_ack: true }),
      })
      const body = (await response.json()) as { session: { meds_warning_ack: boolean; status: string } }
      expect(response.status).toBe(200)
      expect(body.session.meds_warning_ack).toBe(false)
      expect(body.session.status).toBe('planned')

      const confirmed = await fetch(`${server.url}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sessionInput({ drinker_name: 'Hei', meds_confirmed: true })),
      })
      const confirmedBody = (await confirmed.json()) as { session: { meds_warning_ack: boolean } }
      expect(confirmedBody.session.meds_warning_ack).toBe(true)
    } finally {
      await server.close()
    }
  })

  it('renders the warning on Plan tonight and not on Tonight', () => {
    const plan = renderToStaticMarkup(createElement(App))
    const tonight = renderToStaticMarkup(createElement(App, { initialHash: '#/tonight' }))
    expect(plan).toContain(MEDS_WARNINGS[0])
    expect(plan).toContain(REFUSAL_SCRIPTS[0])
    expect(plan).toContain(copy.needChecks)
    expect(plan).toContain('name="share_location"')
    expect(plan).toContain('name="meds_confirmed"')
    expect(plan).not.toMatch(/name="share_location"[^>]*checked/)
    expect(plan).not.toMatch(/name="meds_confirmed"[^>]*checked/)
    expect(plan).toContain(`disabled="">${copy.create}`)
    expect(tonight).not.toContain(MEDS_WARNINGS[0])
    expect(tonight).not.toContain(REFUSAL_SCRIPTS[0])
  })
})
