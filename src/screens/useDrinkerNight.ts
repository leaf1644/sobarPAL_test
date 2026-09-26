import { useEffect, useRef, useState } from 'react'
import { ApiError, httpApi, messageFrom } from '../client/api'
import { createSparseLog, memoryStorage, type StorageLike } from '../client/sparseLog'
import { copy } from '../copy'
import { drinkBatch, drinkTap, waterTap } from '../domain/log'
import { evaluateSessionNudges, type NudgeKind } from '../domain/nudge'
import { shouldClearLocalLog } from '../domain/retention'
import type { LogEvent, TonightSession } from '../domain/types'

export const SESSION_KEY = 'soberpal.sessionId'

export function useDrinkerNight(sessionId?: string) {
  const [session, setSession] = useState<TonightSession | null>(null)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [serverNow, setServerNow] = useState('')
  const [banner, setBanner] = useState<NudgeKind | null>(null)
  const [error, setError] = useState('')
  const [ping, setPing] = useState('')
  const logRef = useRef<ReturnType<typeof createSparseLog> | null>(null)
  const notedKey = useRef<string | null>(null)

  useEffect(() => {
    const id = sessionId || readSavedId()
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
        if (!stop) setError(messageFrom(cause, copy.errLoad))
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

  function addDrink(count: 1 | 2) {
    if (!session || !logRef.current) {
      setError(copy.errNeedPlan)
      return
    }
    const spec = count === 2 ? drinkBatch() : drinkTap()
    setEvents(logRef.current.add({ ...spec, now: nowMs }))
    setError('')
  }

  function addWater() {
    if (!session || !logRef.current) {
      setError(copy.errNeedPlan)
      return
    }
    setEvents(logRef.current.add({ ...waterTap(), now: nowMs }))
    setBanner(null)
    setError('')
  }

  function undo(id: string) {
    if (!logRef.current) return
    const result = logRef.current.undo(id)
    setEvents(result.events)
    if (!result.ok) setError(copy.errUndo)
  }

  async function goHome() {
    if (!session) {
      setError(copy.errNeedPlan)
      return
    }
    try {
      const result = await httpApi.markHome(session.id)
      setSession(result.session)
      setServerNow(result.server_now)
      setBanner(null)
      if (logRef.current) {
        setEvents(
          logRef.current.add({ kind: 'home', count: 1, source: 'tap', now: Date.parse(result.server_now) }),
        )
      }
    } catch (cause) {
      setError(messageFrom(cause, copy.errHome))
    }
  }

  function notePause() {
    if (!logRef.current || !serverNow) return
    setEvents(logRef.current.add({ kind: 'pause', count: 1, source: 'tap', now: Date.parse(serverNow) }))
  }

  async function sharePing() {
    if (!session) return
    try {
      const result = await httpApi.ping(session.id, ping)
      setSession(result.session)
      setServerNow(result.server_now)
      setPing('')
    } catch (cause) {
      setError(messageFrom(cause, copy.errPing))
    }
  }

  async function advance(minutes: number) {
    if (!session) return
    try {
      const result = await httpApi.advance(minutes, session.id)
      setSession(result.session)
      setServerNow(result.server_now)
    } catch (cause) {
      setError(messageFrom(cause, copy.errClock))
    }
  }

  async function jump() {
    if (!session) return
    try {
      const result = await httpApi.jumpPastGrace(session.id)
      setSession(result.session)
      setServerNow(result.server_now)
    } catch (cause) {
      setError(messageFrom(cause, copy.errClock))
    }
  }

  async function dismiss() {
    if (!session) return
    const result = await httpApi.dismissNudges(session.id)
    setSession(result.session)
    setBanner(null)
  }

  async function cancelTonight() {
    if (!session) return
    try {
      const result = await httpApi.cancel(session.id)
      setSession(result.session)
    } catch (cause) {
      setError(messageFrom(cause, copy.errCancel))
    }
  }

  function hideBanner() {
    setBanner(null)
  }

  function openFocus() {
    if (!session) {
      setError(copy.errNeedPlan)
      return
    }
    if (typeof window === 'undefined') return
    window.location.hash = `#/focus/${session.id}`
  }

  return {
    session,
    setSession,
    events,
    banner,
    error,
    setError,
    ping,
    setPing,
    addDrink,
    addWater,
    undo,
    goHome,
    notePause,
    sharePing,
    advance,
    jump,
    dismiss,
    cancelTonight,
    hideBanner,
    openFocus,
  }
}

function readSavedId(): string | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  return sessionStorage.getItem(SESSION_KEY) ?? undefined
}

function browserOrMemory(): StorageLike {
  if (typeof localStorage === 'undefined') return memoryStorage()
  return localStorage
}
