import type { NudgePolicy, SessionStatus, TonightSession } from './types'

export const WATER_NUDGE_GAP_MS = 45 * 60 * 1000
export const NUDGE_MIN_GAP_MS = 30 * 60 * 1000
export const HEADING_HOME_BEFORE_MS = 10 * 60 * 1000

export type NudgeKind = 'water' | 'heading_home'

export type NudgeClock = {
  dismissed_for_tonight: boolean
  last_water_nudge_at: number | null
  heading_home_sent: boolean
  last_nudge_at: number | null
}

/**
 * In-page SessionWatch. Inputs are only the check-in time, session status,
 * and nudge policy. Drink totals and Focus Check results are not parameters.
 */
export function evaluateNudges(input: {
  now: number
  check_in_at: number
  status: SessionStatus
  policy: NudgeClock
}): NudgeKind | null {
  if (input.status !== 'active') return null
  if (input.policy.dismissed_for_tonight) return null
  if (input.now >= input.check_in_at) return null

  const gapOk =
    input.policy.last_nudge_at == null || input.now - input.policy.last_nudge_at >= NUDGE_MIN_GAP_MS
  const headingWindow =
    input.now >= input.check_in_at - HEADING_HOME_BEFORE_MS && input.now < input.check_in_at

  if (headingWindow && !input.policy.heading_home_sent && gapOk) return 'heading_home'

  const waterGapOk =
    input.policy.last_water_nudge_at == null ||
    input.now - input.policy.last_water_nudge_at >= WATER_NUDGE_GAP_MS

  if (!waterGapOk || !gapOk) return null
  if (headingWindow && !input.policy.heading_home_sent) return null
  return 'water'
}

export function evaluateSessionNudges(
  session: Pick<TonightSession, 'status' | 'check_in_at' | 'nudge_policy'>,
  nowMs: number,
): NudgeKind | null {
  return evaluateNudges({
    now: nowMs,
    check_in_at: Date.parse(session.check_in_at),
    status: session.status,
    policy: clockFromPolicy(session.nudge_policy),
  })
}

export function nudgeCopy(kind: NudgeKind): string {
  if (kind === 'water') return 'Time for water?'
  return 'heading home?'
}

function clockFromPolicy(policy: NudgePolicy): NudgeClock {
  return {
    dismissed_for_tonight: policy.dismissed_for_tonight,
    last_water_nudge_at: policy.last_water_nudge_at ? Date.parse(policy.last_water_nudge_at) : null,
    heading_home_sent: policy.heading_home_sent,
    last_nudge_at: policy.last_nudge_at ? Date.parse(policy.last_nudge_at) : null,
  }
}
