export const SESSION_STATUSES = ['planned', 'active', 'home', 'missed', 'cancelled'] as const

export type SessionStatus = (typeof SESSION_STATUSES)[number]

export type Ping = {
  at: string
  label: string
}

export type NudgePolicy = {
  dismissed_for_tonight: boolean
  last_water_nudge_at: string | null
  heading_home_sent: boolean
  last_nudge_at: string | null
}

export type TonightSession = {
  id: string
  drinker_id: string
  drinker_name: string
  guardian_id: string | null
  guardian_name: string
  pending_guardian_name: string | null
  guardian_accepted: boolean
  check_in_at: string
  grace_minutes: number
  status: SessionStatus
  share_location: boolean
  primary_drink_type: string
  personal_limit_serves: number
  meds_warning_ack: boolean
  magic_token: string
  last_ping: Ping | null
  needs_ok_prompt: boolean
  nudge_policy: NudgePolicy
  created_at: string
  ended_at: string | null
  missed_notified_at: string | null
  last_guardian_reminder_at: string | null
}

export type CreateSessionInput = {
  drinker_id?: string
  drinker_name: string
  guardian_name: string
  check_in_at: string
  personal_limit_serves: number
  primary_drink_type: string
  share_location?: boolean
  meds_confirmed?: boolean
  grace_minutes?: number
}

export const LOG_KINDS = ['drink', 'water', 'pause', 'home', 'extend'] as const
export const LOG_SOURCES = ['tap', 'widget', 'batch', 'watch'] as const

export type LogKind = (typeof LOG_KINDS)[number]
export type LogSource = (typeof LOG_SOURCES)[number]

export type LogEvent = {
  id: string
  session_id: string
  kind: LogKind
  count: number
  source: LogSource
  undone: boolean
  created_at: string
}

export type GuardianView = {
  drinker_name: string
  status: SessionStatus
  guardian_accepted: boolean
  last_ping: Ping | null
  needs_check_in_followup: boolean
  last_guardian_reminder_at: string | null
}
