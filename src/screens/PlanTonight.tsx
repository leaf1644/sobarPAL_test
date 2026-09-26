import { useEffect, useState, type FormEvent } from 'react'
import { httpApi } from '../client/api'
import { confirmSwapLine, copy, graceLine } from '../copy'
import { DEFAULT_GRACE_MINUTES, checkInStatusLabel } from '../domain/session'
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
      setError(cause instanceof Error ? cause.message : copy.errCreate)
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
      setError(cause instanceof Error ? cause.message : copy.errSwap)
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
      setError(cause instanceof Error ? cause.message : copy.errConfirm)
    }
  }

  async function cancelChange() {
    if (!session) return
    const result = await httpApi.cancelGuardianChange(session.id)
    setSession(result.session)
  }

  return (
    <section className="card">
      <p className="eyebrow">{copy.planEyebrow}</p>
      <h2>{copy.planTitle}</h2>
      <p className="lede">{copy.planLede}</p>
      <p className="quiet">{graceLine(DEFAULT_GRACE_MINUTES)}</p>
      <form onSubmit={onCreate} className="stack">
        <label>
          {copy.yourName}
          <input name="drinker_name" value={drinkerName} onChange={(event) => setDrinkerName(event.target.value)} required />
        </label>
        <label>
          {copy.guardian}
          <input
            name="guardian_name"
            value={guardianName}
            onChange={(event) => setGuardianName(event.target.value)}
            required
          />
        </label>
        <label>
          {copy.limit}
          <input
            name="personal_limit_serves"
            type="number"
            min={0}
            step={1}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            required
          />
          <span className="quiet">{copy.limitHint}</span>
        </label>
        <label>
          {copy.drink}
          <select name="primary_drink_type" value={drinkType} onChange={(event) => setDrinkType(event.target.value)}>
            <option value="beer">{copy.beer}</option>
            <option value="wine">{copy.wine}</option>
            <option value="spirits">{copy.spirits}</option>
            <option value="other">{copy.other}</option>
          </select>
        </label>
        <label>
          {copy.homeTime}
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
          {copy.shareLocation}
        </label>
        <div className="meds">
          <h3>{copy.medsTitle}</h3>
          <ul>
            {meds.warnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>{copy.refusalTitle}</h3>
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
            {copy.medsAck}
          </label>
        </div>
        <button type="submit" className="hit primary" disabled={busy}>
          {copy.create}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {session && (
        <div className="result">
          <p>
            {copy.statusPrefix}：<strong data-testid="session-status">{checkInStatusLabel(session.status)}</strong>
          </p>
          <p className="quiet">{copy.linkHint}</p>
          <input data-testid="magic-link" readOnly value={link} aria-label={copy.linkLabel} />
          <p>
            <a href={`#/tonight/${session.id}`}>{copy.openTonight}</a>
          </p>
          <div className="stack">
            <label>
              {copy.swapLabel}
              <input value={nextGuardian} onChange={(event) => setNextGuardian(event.target.value)} />
            </label>
            <button type="button" className="hit secondary" onClick={() => void propose()}>
              {copy.swapButton}
            </button>
            {session.pending_guardian_name && (
              <div className="confirm">
                <p>{confirmSwapLine(session.pending_guardian_name)}</p>
                <button type="button" className="hit" onClick={() => void confirm()}>
                  {copy.confirmSwapButton}
                </button>
                <button type="button" className="hit secondary" onClick={() => void cancelChange()}>
                  {copy.cancelSwap}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
