import { useEffect, useRef, useState } from 'react'
import { ApiError, httpApi } from '../client/api'
import { createSparseLog, memoryStorage, type StorageLike } from '../client/sparseLog'
import { actionsOpen, canUndo, drinkBatch, drinkTap, loggedAtLeast, loggedAtLeastCopy, waterTap } from '../domain/log'
import { evaluateSessionNudges, nudgeCopy, type NudgeKind } from '../domain/nudge'
import { requestHome, sessionAfterFocusCheck, type FocusOutcome } from '../domain/focusCheck'
import { shouldClearLocalLog } from '../domain/retention'
import { magicLinkFromPage } from '../route'
import type { LogEvent, TonightSession } from '../domain/types'
import { FocusCheck, NightActions } from './FocusCheck'

const SESSION_KEY = 'soberpal.sessionId'

export function Tonight({ sessionId }: { sessionId?: string }) {
  const [session, setSession] = useState<TonightSession | null>(null)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [serverNow, setServerNow] = useState('')
  const [banner, setBanner] = useState<NudgeKind | null>(null)
  const [focus, setFocus] = useState(false)
  const [error, setError] = useState('')
  const [ping, setPing] = useState('')
  const [nextGuardian, setNextGuardian] = useState('')
  const logRef = useRef<ReturnType<typeof createSparseLog> | null>(null)
  const notedKey = useRef<string | null>(null)
  const activeId = useRef<string | undefined>(sessionId)

  useEffect(() => {
    activeId.current = sessionId || readSavedId()
    const id = activeId.current
    if (!id) return
    const log = createSparseLog(browserOrMemory(), id)
    logRef.current = log
    setEvents(log.list())

    let stop = false
    async function load() {
      try {
        const result = await httpApi.getSession(id!)
        if (stop) return
        setSession(result.session)
        setServerNow(result.server_now)
        setError('')
      } catch (cause) {
        if (cause instanceof ApiError && shouldClearLocalLog(cause.status)) {
          logRef.current?.clear()
          setEvents([])
        }
        if (!stop) setError(cause instanceof Error ? cause.message : 'Could not load tonight')
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [sessionId])

  useEffect(() => {
    if (!session || !serverNow) return
    const nudge = evaluateSessionNudges(session, Date.parse(serverNow))
    if (!nudge) return
    const key = `${session.id}:${nudge}:${session.nudge_policy.last_nudge_at ?? 'none'}`
    if (notedKey.current === key) return
    notedKey.current = key
    setBanner(nudge)
    void httpApi.noteNudge(session.id, nudge).then((result) => {
      setSession(result.session)
      setServerNow(result.server_now)
    })
  }, [session, serverNow])

  const nowMs = serverNow ? Date.parse(serverNow) : Date.now()
  const open = actionsOpen(session?.personal_limit_serves ?? 0, loggedAtLeast(events))
  const link =
    session && typeof window !== 'undefined' ? magicLinkFromPage(window.location.href, session.magic_token) : ''

  function remember(next: LogEvent[]) {
    setEvents(next)
  }

  function addDrink(count: 1 | 2) {
    if (!session || !logRef.current) {
      setError('Plan tonight first')
      return
    }
    const spec = count === 2 ? drinkBatch() : drinkTap()
    remember(logRef.current.add({ ...spec, now: nowMs }))
    setError('')
  }

  function addWater() {
    if (!session || !logRef.current) {
      setError('Plan tonight first')
      return
    }
    const spec = waterTap()
    remember(logRef.current.add({ ...spec, now: nowMs }))
    setBanner(null)
    setError('')
  }

  function undo(id: string) {
    if (!logRef.current) return
    const result = logRef.current.undo(id, nowMs)
    remember(result.events)
    if (!result.ok) setError('Undo is only available for 30 seconds')
  }

  async function goHome() {
    if (!session) {
      setError('Plan tonight first')
      return
    }
    const decision = requestHome(session, { active: focus, outcome: null })
    if (!decision.proceed) return
    try {
      const result = await httpApi.markHome(decision.session.id)
      setSession(result.session)
      setServerNow(result.server_now)
      setFocus(false)
      setBanner(null)
      if (logRef.current) {
        remember(logRef.current.add({ kind: 'home', count: 1, source: 'tap', now: Date.parse(result.server_now) }))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check in')
    }
  }

  function leaveFocus(outcome: FocusOutcome) {
    if (session) sessionAfterFocusCheck(session, outcome)
    setFocus(false)
    if (logRef.current && serverNow) {
      remember(logRef.current.add({ kind: 'pause', count: 1, source: 'tap', now: Date.parse(serverNow) }))
    }
  }

  async function sharePing() {
    if (!session) return
    try {
      const result = await httpApi.ping(session.id, ping)
      setSession(result.session)
      setServerNow(result.server_now)
      setPing('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not share a ping')
    }
  }

  async function reload(id: string) {
    const result = await httpApi.getSession(id)
    setSession(result.session)
    setServerNow(result.server_now)
  }

  async function advance(minutes: number) {
    if (!session) return
    try {
      await httpApi.advance(minutes)
      await reload(session.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not move the clock')
    }
  }

  async function jump() {
    if (!session) return
    try {
      await httpApi.jumpPastGrace(session.id)
      await reload(session.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not move the clock')
    }
  }

  async function propose() {
    if (!session) return
    try {
      const result = await httpApi.proposeGuardian(session.id, nextGuardian)
      setSession(result.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not stage the change')
    }
  }

  async function confirm() {
    if (!session) return
    try {
      const result = await httpApi.confirmGuardian(session.id)
      setSession(result.session)
      setNextGuardian('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Confirmation failed')
    }
  }

  async function dismiss() {
    if (!session) return
    const result = await httpApi.dismissNudges(session.id)
    setSession(result.session)
    setBanner(null)
  }

  return (
    <div className="tonight">
      {session?.needs_ok_prompt && (
        <p className="banner sticky" data-testid="are-you-ok">
          are you OK?
        </p>
      )}
      {focus && session ? (
        <FocusCheck onLeave={leaveFocus} onDrink={() => addDrink(1)} onDrinkBatch={() => addDrink(2)} onHome={() => void goHome()} />
      ) : (
        <section className="card">
          <p className="eyebrow">Tonight</p>
          <h2>Tonight</h2>
          {session ? (
            <p>
              Status: <strong data-testid="session-status">{session.status}</strong>
            </p>
          ) : (
            <p>先到 Plan tonight 建立時段。下面三個動作在有時段之後才會記下來。</p>
          )}
          {session && (
            <p className="quiet">
              {session.drinker_name} · Guardian {session.guardian_name}
              {session.guardian_accepted ? ' · connected' : ' · waiting for accept'} · limit {session.personal_limit_serves}{' '}
              {session.primary_drink_type}
            </p>
          )}
          <p data-testid="logged-at-least">{loggedAtLeastCopy(events)}</p>
          <p className="quiet">至少記了這些，不是完整紀錄。剩下幾杯不會鎖住任何按鈕。</p>
          {banner && (
            <div className="banner" data-testid="nudge-banner">
              <p>{nudgeCopy(banner)}</p>
              <button type="button" className="hit" onClick={addWater}>
                + Water
              </button>
              <button type="button" className="hit secondary" onClick={() => setBanner(null)}>
                Not now
              </button>
              <button type="button" className="hit secondary" onClick={() => void dismiss()}>
                Dismiss for tonight
              </button>
            </div>
          )}
          <NightActions
            onDrink={() => addDrink(1)}
            onDrinkBatch={() => addDrink(2)}
            onFocus={() => (session ? setFocus(true) : setError('Plan tonight first'))}
            onHome={() => void goHome()}
          />
          <button type="button" className="hit water" onClick={addWater} disabled={!open}>
            + Water
          </button>
          <ul className="log-list">
            {events.map((event) => (
              <li key={event.id}>
                <span>
                  {event.undone ? 'undone ' : ''}
                  {event.kind} × {event.count}
                </span>
                {canUndo(event, nowMs) && (
                  <button type="button" className="hit tiny" onClick={() => undo(event.id)}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
          {session && link && (
            <label>
              Magic link
              <input readOnly value={link} aria-label="Magic link" />
            </label>
          )}
          {session?.status === 'active' && session.guardian_accepted && session.share_location && (
            <div className="stack">
              <label>
                Last ping
                <input value={ping} onChange={(event) => setPing(event.target.value)} placeholder="MTR exit B" />
              </label>
              <button type="button" className="hit" onClick={() => void sharePing()}>
                Share last ping
              </button>
              <p className="quiet">只留下這一次，不累積路線。</p>
            </div>
          )}
          {session && session.status !== 'home' && session.status !== 'cancelled' && (
            <div className="stack demo-clock">
              <p className="quiet">演示時鐘。兩台電腦共用伺服器時間。</p>
              <button type="button" className="hit secondary" onClick={() => void advance(15)}>
                +15 min
              </button>
              <button type="button" className="hit secondary" onClick={() => void jump()}>
                Past check-in grace
              </button>
            </div>
          )}
          {session && session.status !== 'home' && session.status !== 'cancelled' && (
            <div className="stack">
              <label>
                Replace Guardian
                <input value={nextGuardian} onChange={(event) => setNextGuardian(event.target.value)} />
              </label>
              <button type="button" className="hit secondary" onClick={() => void propose()}>
                Replace Guardian
              </button>
              {session.pending_guardian_name && (
                <>
                  <p>Confirm change to {session.pending_guardian_name}?</p>
                  <button type="button" className="hit" onClick={() => void confirm()}>
                    Confirm guardian change
                  </button>
                </>
              )}
              <button
                type="button"
                className="hit secondary"
                onClick={() => {
                  void httpApi.cancel(session.id).then((result) => setSession(result.session)).catch((cause: unknown) => {
                    setError(cause instanceof Error ? cause.message : 'Could not cancel')
                  })
                }}
              >
                Cancel tonight
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </div>
  )
}

function readSavedId(): string | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  return sessionStorage.getItem(SESSION_KEY) ?? undefined
}

function browserOrMemory(): StorageLike {
  if (typeof localStorage === 'undefined') return memoryStorage()
  return localStorage
}
