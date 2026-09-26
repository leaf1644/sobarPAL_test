import { useEffect, useState } from 'react'
import { httpApi } from '../client/api'
import { showGuardianAccept } from '../domain/session'
import type { GuardianView } from '../domain/types'

export function GuardianMode({ token }: { token?: string }) {
  const [view, setView] = useState<GuardianView | null>(null)
  const [calling, setCalling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let stop = false
    async function load() {
      try {
        const result = await httpApi.guardianView(token!)
        if (!stop) setView(result.view)
      } catch (cause) {
        if (!stop) setError(cause instanceof Error ? cause.message : 'Could not open the invite')
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
      setError(cause instanceof Error ? cause.message : 'Could not accept')
    }
  }

  if (!token) {
    return (
      <section className="card">
        <p className="eyebrow">Guardian mode</p>
        <h2>Guardian mode</h2>
        <p>在第二台電腦打開飲酒者給你的 magic link。這台電腦不會看到飲酒日記。</p>
      </section>
    )
  }

  return (
    <section className="card">
      <p className="eyebrow">Guardian mode</p>
      <h2>{view ? `Looking out for ${view.drinker_name}` : 'Guardian mode'}</h2>
      {!view && !error && <p>Loading the invite…</p>}
      {error && <p className="error">{error}</p>}
      {view && <GuardianCard view={view} calling={calling} onCall={() => setCalling(true)} onAccept={() => void accept()} />}
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
        Status: <strong data-testid="session-status">{view.status}</strong>
      </p>
      <p data-testid="check-in-status">{view.check_in_status}</p>
      {view.needs_check_in_followup && (
        <p className="banner">{view.drinker_name} missed the check-in. Last shared location is below, if there is one.</p>
      )}
      {view.last_ping ? (
        <div className="ping" data-testid="last-ping">
          <p>Last ping</p>
          <p>{view.last_ping.label}</p>
          <p className="quiet">{view.last_ping.at}</p>
        </div>
      ) : (
        <p className="quiet">No location shared.</p>
      )}
      <button type="button" className="hit call" data-testid="guardian-call" onClick={onCall}>
        {view.call_label}
      </button>
      {calling && <p>Opening a call to {view.drinker_name}. This demo does not place a real phone call.</p>}
      {showGuardianAccept(view) && (
        <button type="button" className="hit primary" onClick={onAccept}>
          Accept
        </button>
      )}
      {view.last_guardian_reminder_at && view.needs_check_in_followup && (
        <p className="quiet">Last reminder {view.last_guardian_reminder_at}</p>
      )}
    </>
  )
}
