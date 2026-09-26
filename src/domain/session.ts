import { deadlineMs, isGuardianAlert, isReminderDue } from './alert'
import { DomainError } from './errors'
import { storeMedsAck } from './meds'
import type { NudgeKind } from './nudge'
import type { CreateSessionInput, GuardianView, NudgePolicy, SessionStatus, TonightSession } from './types'

export const DEFAULT_GRACE_MINUTES = 10

export function emptyNudgePolicy(): NudgePolicy {
  return {
    dismissed_for_tonight: false,
    last_water_nudge_at: null,
    heading_home_sent: false,
    last_nudge_at: null,
  }
}

export function createSessionRecord(
  input: CreateSessionInput,
  nowMs: number,
  ids: { id: string; token: string },
): TonightSession {
  const drinkerName = input.drinker_name.trim()
  const guardianName = input.guardian_name.trim()
  if (!drinkerName) throw new DomainError('drinker_name is required')
  if (!guardianName) throw new DomainError('guardian_name is required')
  const checkIn = Date.parse(input.check_in_at)
  if (Number.isNaN(checkIn)) throw new DomainError('check_in_at is invalid')
  if (!Number.isInteger(input.personal_limit_serves) || input.personal_limit_serves < 0) {
    throw new DomainError('personal_limit_serves must be a whole number')
  }
  const drink = input.primary_drink_type.trim()
  if (!drink) throw new DomainError('primary_drink_type is required')
  const grace = input.grace_minutes ?? DEFAULT_GRACE_MINUTES
  if (!Number.isInteger(grace) || grace < 0 || grace > 180) {
    throw new DomainError('grace_minutes is invalid')
  }
  const nowIso = new Date(nowMs).toISOString()
  return {
    id: ids.id,
    drinker_id: input.drinker_id?.trim() || `drinker_${ids.id}`,
    drinker_name: drinkerName,
    guardian_id: null,
    guardian_name: guardianName,
    pending_guardian_name: null,
    guardian_accepted: false,
    check_in_at: new Date(checkIn).toISOString(),
    grace_minutes: grace,
    status: 'planned',
    share_location: input.share_location === true,
    primary_drink_type: drink,
    personal_limit_serves: input.personal_limit_serves,
    meds_warning_ack: storeMedsAck(input.meds_confirmed === true),
    magic_token: ids.token,
    last_ping: null,
    needs_ok_prompt: false,
    nudge_policy: emptyNudgePolicy(),
    created_at: nowIso,
    ended_at: null,
    missed_notified_at: null,
    last_guardian_reminder_at: null,
  }
}

export function proposeGuardian(session: TonightSession, guardianName: string): TonightSession {
  assertOpen(session)
  const name = guardianName.trim()
  if (!name) throw new DomainError('guardian_name is required')
  return { ...session, pending_guardian_name: name }
}

export function confirmGuardian(session: TonightSession, newToken: string): TonightSession {
  assertOpen(session)
  if (!session.pending_guardian_name) throw new DomainError('confirmation required')
  return {
    ...session,
    guardian_name: session.pending_guardian_name,
    pending_guardian_name: null,
    guardian_accepted: false,
    guardian_id: null,
    status: 'planned',
    needs_ok_prompt: false,
    magic_token: newToken,
  }
}

export function cancelGuardianChange(session: TonightSession): TonightSession {
  return { ...session, pending_guardian_name: null }
}

export function acceptGuardian(session: TonightSession): TonightSession {
  if (session.status === 'home' || session.status === 'cancelled') {
    throw new DomainError('session ended')
  }
  if (session.status === 'missed') throw new DomainError('session already missed')
  if (session.guardian_accepted && session.status === 'active') return session
  return {
    ...session,
    guardian_accepted: true,
    guardian_id: slug(session.guardian_name),
    status: 'active',
  }
}

export function markHome(session: TonightSession, nowMs: number): TonightSession {
  if (session.status === 'cancelled') throw new DomainError('session ended')
  if (session.status === 'home') return session
  return {
    ...session,
    status: 'home',
    share_location: false,
    needs_ok_prompt: false,
    ended_at: new Date(nowMs).toISOString(),
  }
}

export function cancelSession(session: TonightSession, nowMs: number): TonightSession {
  if (session.status === 'home') throw new DomainError('already home')
  if (session.status === 'cancelled') return session
  return {
    ...session,
    status: 'cancelled',
    share_location: false,
    needs_ok_prompt: false,
    ended_at: new Date(nowMs).toISOString(),
  }
}

export function recordPing(session: TonightSession, label: string, nowMs: number): TonightSession {
  if (!(session.status === 'active' && session.guardian_accepted && session.share_location)) {
    throw new DomainError('location is not being shared')
  }
  const text = label.trim()
  if (!text) throw new DomainError('ping label required')
  return { ...session, last_ping: { at: new Date(nowMs).toISOString(), label: text } }
}

export function applyWatchdog(
  session: TonightSession,
  nowMs: number,
): { session: TonightSession; becameMissed: boolean } {
  if (!isGuardianAlert(session, nowMs)) return { session, becameMissed: false }
  const nowIso = new Date(nowMs).toISOString()
  return {
    becameMissed: true,
    session: {
      ...session,
      status: 'missed',
      needs_ok_prompt: true,
      missed_notified_at: nowIso,
      last_guardian_reminder_at: nowIso,
    },
  }
}

export function applyReminder(
  session: TonightSession,
  nowMs: number,
): { session: TonightSession; reminded: boolean } {
  if (!isReminderDue(session, nowMs)) return { session, reminded: false }
  return {
    reminded: true,
    session: { ...session, last_guardian_reminder_at: new Date(nowMs).toISOString() },
  }
}

export function dismissNudges(session: TonightSession): TonightSession {
  return {
    ...session,
    nudge_policy: { ...session.nudge_policy, dismissed_for_tonight: true },
  }
}

export function noteNudge(session: TonightSession, kind: NudgeKind, nowMs: number): TonightSession {
  const iso = new Date(nowMs).toISOString()
  return {
    ...session,
    nudge_policy: {
      ...session.nudge_policy,
      last_nudge_at: iso,
      last_water_nudge_at: kind === 'water' ? iso : session.nudge_policy.last_water_nudge_at,
      heading_home_sent: kind === 'heading_home' ? true : session.nudge_policy.heading_home_sent,
    },
  }
}

export function checkInStatusLabel(status: SessionStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned'
    case 'active':
      return 'Still out'
    case 'home':
      return 'Home'
    case 'missed':
      return 'Missed check-in'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function toGuardianView(session: TonightSession): GuardianView {
  return {
    drinker_name: session.drinker_name,
    status: session.status,
    check_in_status: checkInStatusLabel(session.status),
    last_ping: pingVisible(session) ? session.last_ping : null,
    call_label: `Call ${session.drinker_name}`,
    needs_check_in_followup: session.status === 'missed',
    last_guardian_reminder_at: session.last_guardian_reminder_at,
  }
}

export function pingVisible(session: TonightSession): boolean {
  if (!session.guardian_accepted || !session.last_ping) return false
  if (session.status === 'missed') return true
  return session.status === 'active' && session.share_location
}

export { deadlineMs }

function assertOpen(session: TonightSession) {
  if (session.status === 'home' || session.status === 'cancelled') {
    throw new DomainError('session ended')
  }
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') || 'guardian'
}
