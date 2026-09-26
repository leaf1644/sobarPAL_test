import { copy } from '../copy'

export const MEDS_WARNINGS = copy.medsWarnings
export const REFUSAL_SCRIPTS = copy.refusalScripts

export function medsForSurface(surface: 'plan' | 'tonight'): {
  warnings: string[]
  scripts: string[]
} {
  if (surface !== 'plan') return { warnings: [], scripts: [] }
  return { warnings: [...MEDS_WARNINGS], scripts: [...REFUSAL_SCRIPTS] }
}

/** Stored only after the drinker confirms the plan-time warning. */
export function storeMedsAck(confirmed: boolean): boolean {
  return confirmed === true
}
