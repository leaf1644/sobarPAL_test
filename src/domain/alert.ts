import type { SessionStatus, TonightSession } from './types'

export const GUARDIAN_REMINDER_GAP_MS = 20 * 60 * 1000

export type AlertInput = {
  status: SessionStatus
  check_in_at: string
  grace_minutes: number
}

/** Guardian alert := active AND now > check_in_at + grace AND NOT home. */
export function isGuardianAlert(session: AlertInput, nowMs: number): boolean {
  if (session.status !== 'active') return false
  return nowMs > deadlineMs(session)
}

export function deadlineMs(session: Pick<AlertInput, 'check_in_at' | 'grace_minutes'>): number {
  return Date.parse(session.check_in_at) + session.grace_minutes * 60_000
}

export function isReminderDue(
  session: Pick<TonightSession, 'status' | 'last_guardian_reminder_at'>,
  nowMs: number,
): boolean {
  if (session.status !== 'missed' || !session.last_guardian_reminder_at) return false
  return nowMs - Date.parse(session.last_guardian_reminder_at) >= GUARDIAN_REMINDER_GAP_MS
}
