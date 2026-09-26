export const MEDS_WARNINGS = [
  '有些藥和酒精一起用，會加重嗜睡、出血或肝臟負擔。這是提醒，不是診斷。',
  '不確定的話，今晚可以不喝，或先問藥師、醫師。',
]

export const REFUSAL_SCRIPTS = [
  '我今晚有吃藥，所以不喝酒。',
  '我喝水就好。',
  '下次再陪你們喝。',
]

export function medsForSurface(surface: 'plan' | 'tonight'): {
  warnings: string[]
  scripts: string[]
} {
  if (surface !== 'plan') return { warnings: [], scripts: [] }
  return { warnings: MEDS_WARNINGS, scripts: REFUSAL_SCRIPTS }
}

/** Stored only after the drinker confirms the plan-time warning. */
export function storeMedsAck(confirmed: boolean): boolean {
  return confirmed === true
}
