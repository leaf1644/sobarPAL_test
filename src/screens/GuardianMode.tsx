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
        if (!stop) setError(cause instanceof Error ? cause.message : '無法打開邀請')
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
      setError(cause instanceof Error ? cause.message : '無法接受')
    }
  }

  if (!token) {
    return (
      <section className="card">
        <p className="eyebrow">守護者</p>
        <h2>守護者模式</h2>
        <p>在第二台電腦打開飲酒者給你的邀請連結。這台電腦不會看到飲酒日記。</p>
      </section>
    )
  }

  return (
    <section className="card">
      <p className="eyebrow">守護者</p>
      <h2>{view ? `正在照看${view.drinker_name}` : '守護者模式'}</h2>
      {!view && !error && <p>正在打開邀請…</p>}
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
        狀態：<strong data-testid="session-status">{view.check_in_status}</strong>
      </p>
      <p data-testid="check-in-status">{view.check_in_status}</p>
      {view.needs_check_in_followup && (
        <p className="banner">{view.drinker_name}錯過回報。若有分享，最後位置在下面。</p>
      )}
      {view.last_ping ? (
        <div className="ping" data-testid="last-ping">
          <p>最後位置</p>
          <p>{view.last_ping.label}</p>
          <p className="quiet">{view.last_ping.at}</p>
        </div>
      ) : (
        <p className="quiet">尚未分享位置。</p>
      )}
      <button type="button" className="hit call" data-testid="guardian-call" onClick={onCall}>
        {view.call_label}
      </button>
      {calling && <p>正在聯絡{view.drinker_name}。這個示範不會真的撥出電話。</p>}
      {showGuardianAccept(view) && (
        <button type="button" className="hit primary" onClick={onAccept}>
          接受
        </button>
      )}
      {view.last_guardian_reminder_at && view.needs_check_in_followup && (
        <p className="quiet">上次提醒 {view.last_guardian_reminder_at}</p>
      )}
    </>
  )
}
