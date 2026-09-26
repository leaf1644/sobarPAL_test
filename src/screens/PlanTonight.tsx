import { useEffect, useState, type FormEvent } from 'react'
import { httpApi } from '../client/api'
import { DEFAULT_GRACE_MINUTES } from '../domain/session'
import { medsForSurface } from '../domain/meds'
import { magicLinkFromPage } from '../route'
import type { TonightSession } from '../domain/types'
import { defaultCheckInIso, fromDatetimeLocalValue, toDatetimeLocalValue } from '../time'

const SESSION_KEY = 'soberpal.sessionId'

export function PlanTonight() {
  const meds = medsForSurface('plan')
  const [drinkerName, setDrinkerName] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [limit, setLimit] = useState(3)
  const [drinkType, setDrinkType] = useState('beer')
  const [checkIn, setCheckIn] = useState(() => toDatetimeLocalValue(defaultCheckInIso(Date.now())))
  const [shareLocation, setShareLocation] = useState(true)
  const [medsConfirmed, setMedsConfirmed] = useState(false)
  const [session, setSession] = useState<TonightSession | null>(null)
  const [link, setLink] = useState('')
  const [nextGuardian, setNextGuardian] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) return
    let stop = false
    const timer = window.setInterval(() => {
      void httpApi.getSession(session.id).then((result) => {
        if (!stop) setSession(result.session)
      }).catch(() => undefined)
    }, 2000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [session])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await httpApi.createSession({
        drinker_name: drinkerName,
        guardian_name: guardianName,
        personal_limit_serves: limit,
        primary_drink_type: drinkType,
        check_in_at: fromDatetimeLocalValue(checkIn),
        share_location: shareLocation,
        meds_confirmed: medsConfirmed,
      })
      const next = created.session
      setSession(next)
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_KEY, next.id)
      const page = typeof window === 'undefined' ? 'http://localhost/' : window.location.href
      setLink(magicLinkFromPage(page, next.magic_token))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the session')
    } finally {
      setBusy(false)
    }
  }

  async function propose() {
    if (!session) return
    setError('')
    try {
      const result = await httpApi.proposeGuardian(session.id, nextGuardian)
      setSession(result.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not stage the change')
    }
  }

  async function confirm() {
    if (!session) return
    setError('')
    try {
      const result = await httpApi.confirmGuardian(session.id)
      setSession(result.session)
      const page = typeof window === 'undefined' ? 'http://localhost/' : window.location.href
      setLink(magicLinkFromPage(page, result.session.magic_token))
      setNextGuardian('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confirmation failed')
    }
  }

  async function cancelChange() {
    if (!session) return
    const result = await httpApi.cancelGuardianChange(session.id)
    setSession(result.session)
  }

  return (
    <section className="card">
      <p className="eyebrow">Before you go out</p>
      <h2>Plan tonight</h2>
      <p className="lede">
        設定守護者與預計到家時間。第二台電腦打開 magic link 才連得上。飲酒紀錄不會經過這條連結。
      </p>
      <p className="quiet">Grace {DEFAULT_GRACE_MINUTES} minutes. 寬限內還沒按 I'm home，守護者才會看到錯過回報。</p>
      <form onSubmit={onCreate} className="stack">
        <label>
          Your name
          <input name="drinker_name" value={drinkerName} onChange={(event) => setDrinkerName(event.target.value)} required />
        </label>
        <label>
          Guardian
          <input
            name="guardian_name"
            value={guardianName}
            onChange={(event) => setGuardianName(event.target.value)}
            required
          />
        </label>
        <label>
          Personal limit
          <input
            name="personal_limit_serves"
            type="number"
            min={0}
            step={1}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            required
          />
        </label>
        <label>
          Primary drink
          <select name="primary_drink_type" value={drinkType} onChange={(event) => setDrinkType(event.target.value)}>
            <option value="beer">beer</option>
            <option value="wine">wine</option>
            <option value="spirits">spirits</option>
            <option value="other">other</option>
          </select>
        </label>
        <label>
          I'm-home time
          <input
            name="check_in_at"
            type="datetime-local"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            required
          />
        </label>
        <label className="check">
          <input
            name="share_location"
            type="checkbox"
            checked={shareLocation}
            onChange={(event) => setShareLocation(event.target.checked)}
          />
          守護者接受後，只分享最後一次位置，不記錄路線。
        </label>
        <div className="meds">
          <h3>藥物與酒精</h3>
          <ul>
            {meds.warnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>可以這樣說</h3>
          <ul>
            {meds.scripts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <label className="check">
            <input
              name="meds_confirmed"
              type="checkbox"
              checked={medsConfirmed}
              onChange={(event) => setMedsConfirmed(event.target.checked)}
            />
            我看過這些提醒
          </label>
        </div>
        <button type="submit" className="hit primary" disabled={busy}>
          Create tonight
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {session && (
        <div className="result">
          <p>
            Status: <strong data-testid="session-status">{session.status}</strong>
          </p>
          <p className="quiet">把這條連結拿到第二台電腦打開。</p>
          <input data-testid="magic-link" readOnly value={link} aria-label="Magic link" />
          <p>
            <a href={`#/tonight/${session.id}`}>Open tonight</a>
          </p>
          <div className="stack">
            <label>
              Replace Guardian
              <input value={nextGuardian} onChange={(event) => setNextGuardian(event.target.value)} />
            </label>
            <button type="button" className="hit" onClick={() => void propose()}>
              Replace Guardian
            </button>
            {session.pending_guardian_name && (
              <div className="confirm">
                <p>Confirm change to {session.pending_guardian_name}?</p>
                <button type="button" className="hit" onClick={() => void confirm()}>
                  Confirm guardian change
                </button>
                <button type="button" className="hit secondary" onClick={() => void cancelChange()}>
                  Cancel change
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
