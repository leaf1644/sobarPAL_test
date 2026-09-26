import { copy } from '../copy'
import type { TonightSession } from './types'

export const FOCUS_ROUND_SECONDS = 30
export const FOCUS_DISCLAIMER = copy.focusDisclaimer

export const FOCUS_GAMES = ['reaction', 'match', 'logic'] as const
export type FocusGame = (typeof FOCUS_GAMES)[number]

export type FocusOutcome = {
  game: FocusGame
  completed: true
  passed: null
  duration_hint_seconds: number
}

const SHAPES = ['circle', 'square', 'triangle'] as const

export function reactionScript(seed: number): { appear_at_ms: number } {
  const appear = 800 + (Math.abs(Math.trunc(seed)) % 1200)
  return { appear_at_ms: appear }
}

export function matchRound(seed: number): {
  sample: string
  options: string[]
  match_index: number
} {
  const sample = SHAPES[Math.abs(Math.trunc(seed)) % SHAPES.length]
  const rot = Math.abs(Math.trunc(seed)) % SHAPES.length
  const options = SHAPES.map((_, index) => SHAPES[(index + rot) % SHAPES.length])
  return { sample, options: [...options], match_index: options.indexOf(sample) }
}

export function logicRound(seed: number): {
  sequence: string[]
  choices: string[]
  answer_index: number
} {
  const patterns: { sequence: string[]; next: (typeof SHAPES)[number] }[] = [
    { sequence: ['circle', 'square', 'circle', 'square'], next: 'circle' },
    { sequence: ['triangle', 'triangle', 'circle', 'triangle', 'triangle'], next: 'circle' },
    { sequence: ['square', 'circle', 'square', 'circle'], next: 'square' },
  ]
  const pattern = patterns[Math.abs(Math.trunc(seed)) % patterns.length]
  const choices: string[] = [...SHAPES]
  return {
    sequence: pattern.sequence,
    choices,
    answer_index: choices.indexOf(pattern.next),
  }
}

/** Completion never carries a pass or fail. */
export function completeFocusRound(result: { game: FocusGame; correct: boolean }): FocusOutcome {
  void result.correct
  return {
    game: result.game,
    completed: true,
    passed: null,
    duration_hint_seconds: FOCUS_ROUND_SECONDS,
  }
}

export function sessionAfterFocusCheck<T>(session: T, outcome: FocusOutcome): T {
  if (outcome.passed !== null) {
    throw new Error('Focus Check cannot carry a pass or fail')
  }
  return session
}

export function imHomeAllowed(_focus: { active: boolean; outcome: FocusOutcome | null }): true {
  return true
}

export function requestHome(
  session: TonightSession,
  focus: { active: boolean; outcome: FocusOutcome | null },
): { proceed: true; session: TonightSession } {
  if (imHomeAllowed(focus) !== true) {
    throw new Error("I'm home must stay available")
  }
  const next = focus.outcome ? sessionAfterFocusCheck(session, focus.outcome) : session
  return { proceed: true, session: next }
}
