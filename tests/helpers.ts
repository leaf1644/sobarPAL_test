import type { CreateSessionInput } from '../src/domain/types'

export const T0 = Date.parse('2026-04-01T12:00:00.000Z')

export function sessionInput(over: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    drinker_name: 'Chen',
    guardian_name: 'Mei',
    check_in_at: new Date(T0 + 3 * 60 * 60 * 1000).toISOString(),
    personal_limit_serves: 3,
    primary_drink_type: 'beer',
    share_location: true,
    meds_confirmed: false,
    ...over,
  }
}
