import { useEffect, useState } from 'react'
import { httpApi, messageFrom } from '../client/api'
import { callLabel, callingLine, copy, lookingAfter, missedLine, statusLabel } from '../copy'
import { showGuardianAccept } from '../domain/session'
import { Hero } from './Hero'
import { formatLocal } from '../time'
import type { GuardianView } from '../domain/types'

export function GuardianMode({ token }: { token?: string }) {
  const [view, setView] = useState<GuardianView | null>(null)
  const [calling, setCalling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCalling(false)
    setView(null)
    setError('')
    if (!token) return
    let stop = false
    async function load() {
      try {
        const result = await httpApi.guardianView(token!)
        if (!stop) setView(result.view)
      } catch (cause) {
        if (!stop) setError(messageFrom(cause, copy.errOpen))
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [token])

  async function accept() {
    if (!token) return
    setError('')
    try {
      const result = await httpApi.acceptGuardian(token)
      setView(result.view)
    } catch (cause) {
      setError(messageFrom(cause, copy.errAccept))
    }
  }

  if (!token) {
    return (
      <section className="card">
        <Hero kind="guardian" />
        <p className="eyebrow">{copy.guardianEyebrow}</p>
        <h2>{copy.guardianTitle}</h2>
        <p>{copy.guardianEmpty}</p>
      </section>
    )
  }

  return (
    <section className="card">
      <Hero kind="guardian" />
      <p className="eyebrow">{copy.guardianEyebrow}</p>
      <h2>{view ? lookingAfter(view.drinker_name) : copy.guardianTitle}</h2>
      {!view && !error && <p>{copy.loading}</p>}
      {error && <p className="error">{error}</p>}
      {view && (
        <GuardianCard
          view={view}
          calling={calling}
          onCall={() => setCalling((current) => !current)}
          onAccept={() => void accept()}
        />
      )}
    </section>
  )
}

export function GuardianCard({
  view,
  calling,
  onCall,
  onAccept,
}: {
  view: GuardianView
  calling: boolean
  onCall: () => void
  onAccept: () => void
}) {
  return (
    <>
      <p>
        {copy.statusPrefix}：<strong data-testid="session-status">{statusLabel(view.status)}</strong>
      </p>
      {view.needs_check_in_followup && (
        <p className="banner">{missedLine(view.drinker_name)}</p>
      )}
      {view.status === 'home' ? (
        <p className="banner" data-testid="guardian-home">
          {copy.guardianHome}
        </p>
      ) : view.last_ping ? (
        <div className="ping" data-testid="last-ping">
          <p>{copy.lastPing}</p>
          <p>{view.last_ping.label}</p>
          <p className="quiet">{formatLocal(view.last_ping.at)}</p>
        </div>
      ) : (
        <p className="quiet">{copy.noPing}</p>
      )}
      {view.guardian_accepted && (
        <button type="button" className="hit call" data-testid="guardian-call" onClick={onCall}>
          {callLabel(view.drinker_name)}
        </button>
      )}
      {view.guardian_accepted && calling && <p>{callingLine(view.drinker_name)}</p>}
      {showGuardianAccept(view) && (
        <button type="button" className="hit primary" onClick={onAccept}>
          {copy.accept}
        </button>
      )}
      {view.last_guardian_reminder_at && view.needs_check_in_followup && (
        <p className="quiet">
          {copy.lastReminder} {formatLocal(view.last_guardian_reminder_at)}
        </p>
      )}
    </>
  )
}
