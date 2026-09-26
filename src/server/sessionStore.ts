import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { deadlineMs } from '../domain/alert'
import { DomainError } from '../domain/errors'
import { isSessionExpired } from '../domain/retention'
import {
  acceptGuardian,
  applyReminder,
  applyWatchdog,
  cancelGuardianChange,
  cancelSession,
  confirmGuardian,
  createSessionRecord,
  dismissNudges,
  markHome,
  noteNudge,
  proposeGuardian,
  recordPing,
  toGuardianView,
} from '../domain/session'
import type { CreateSessionInput, GuardianView, TonightSession } from '../domain/types'
import type { NudgeKind } from '../domain/nudge'
import { fixedClock, systemClock, type Clock } from './clock'

type Persisted = { sessions: TonightSession[] }

export type SessionStore = {
  now(): number
  create(input: CreateSessionInput, now?: number): TonightSession
  getSnapshot(id: string): TonightSession | null
  getByToken(token: string): TonightSession | null
  acceptByToken(token: string): TonightSession
  proposeGuardian(id: string, name: string): TonightSession
  confirmGuardian(id: string): TonightSession
  cancelGuardianChange(id: string): TonightSession
  markHome(id: string, now?: number): TonightSession
  cancel(id: string, now?: number): TonightSession
  recordPing(id: string, label: string, now?: number): TonightSession
  dismissNudges(id: string): TonightSession
  noteNudge(id: string, kind: NudgeKind, now?: number): TonightSession
  guardianView(token: string): GuardianView
  advance(minutes: number): number
  jumpPastGrace(id: string): number
  watchdogTick(now?: number): { missedIds: string[]; remindedIds: string[]; purgedIds: string[] }
}

export function createSessionStore(options?: { persistPath?: string; clock?: Clock }): SessionStore {
  const clock = options?.clock ?? systemClock()
  const persistPath = options?.persistPath
  const sessions = new Map<string, TonightSession>()

  if (persistPath) load(persistPath, sessions)

  function persist() {
    if (!persistPath) return
    mkdirSync(dirname(persistPath), { recursive: true })
    const body: Persisted = { sessions: [...sessions.values()] }
    writeFileSync(persistPath, JSON.stringify(body, null, 2))
  }

  function put(session: TonightSession) {
    sessions.set(session.id, session)
    persist()
  }

  function must(id: string): TonightSession {
    const session = sessions.get(id)
    if (!session) throw new DomainError('session_not_found', 404)
    return session
  }

  function mustToken(token: string): TonightSession {
    for (const session of sessions.values()) {
      if (session.magic_token === token) return session
    }
    throw new DomainError('session_not_found', 404)
  }

  const store: SessionStore = {
    now: () => clock.now(),
    create(input, now = clock.now()) {
      const session = createSessionRecord(input, now, { id: newId('ses'), token: newId('tok') })
      put(session)
      return clone(session)
    },
    getSnapshot(id) {
      const session = sessions.get(id)
      return session ? clone(session) : null
    },
    getByToken(token) {
      for (const session of sessions.values()) {
        if (session.magic_token === token) return clone(session)
      }
      return null
    },
    acceptByToken(token) {
      const next = acceptGuardian(mustToken(token))
      put(next)
      return clone(next)
    },
    proposeGuardian(id, name) {
      const next = proposeGuardian(must(id), name)
      put(next)
      return clone(next)
    },
    confirmGuardian(id) {
      const next = confirmGuardian(must(id), newId('tok'))
      put(next)
      return clone(next)
    },
    cancelGuardianChange(id) {
      const next = cancelGuardianChange(must(id))
      put(next)
      return clone(next)
    },
    markHome(id, now = clock.now()) {
      const next = markHome(must(id), now)
      put(next)
      return clone(next)
    },
    cancel(id, now = clock.now()) {
      const next = cancelSession(must(id), now)
      put(next)
      return clone(next)
    },
    recordPing(id, label, now = clock.now()) {
      const next = recordPing(must(id), label, now)
      put(next)
      return clone(next)
    },
    dismissNudges(id) {
      const next = dismissNudges(must(id))
      put(next)
      return clone(next)
    },
    noteNudge(id, kind, now = clock.now()) {
      const next = noteNudge(must(id), kind, now)
      put(next)
      return clone(next)
    },
    guardianView(token) {
      return toGuardianView(mustToken(token))
    },
    advance(minutes) {
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
        throw new DomainError('minutes_invalid')
      }
      clock.advance(minutes * 60_000)
      store.watchdogTick(clock.now())
      return clock.now()
    },
    jumpPastGrace(id) {
      const target = deadlineMs(must(id)) + 1000
      clock.set(target)
      store.watchdogTick(target)
      return target
    },
    watchdogTick(now = clock.now()) {
      const purgedIds: string[] = []
      for (const session of [...sessions.values()]) {
        if (!isSessionExpired(session.created_at, now)) continue
        sessions.delete(session.id)
        purgedIds.push(session.id)
      }
      const missedIds: string[] = []
      for (const session of [...sessions.values()]) {
        const result = applyWatchdog(session, now)
        if (!result.becameMissed) continue
        sessions.set(session.id, result.session)
        missedIds.push(session.id)
      }
      const remindedIds: string[] = []
      for (const session of [...sessions.values()]) {
        const result = applyReminder(session, now)
        if (!result.reminded) continue
        sessions.set(session.id, result.session)
        remindedIds.push(session.id)
      }
      if (purgedIds.length || missedIds.length || remindedIds.length) persist()
      return { missedIds, remindedIds, purgedIds }
    },
  }

  return store
}

export function demoClock(): Clock {
  return systemClock()
}

export function testClock(start: number): Clock {
  return fixedClock(start)
}

function load(path: string, sessions: Map<string, TonightSession>) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Persisted
    for (const session of parsed.sessions ?? []) sessions.set(session.id, session)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}
