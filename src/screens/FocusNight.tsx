import { sessionAfterFocusCheck, type FocusOutcome } from '../domain/focusCheck'
import { FocusCheck } from './FocusCheck'
import { useDrinkerNight } from './useDrinkerNight'

export function FocusNight({ sessionId }: { sessionId?: string }) {
  const night = useDrinkerNight(sessionId)

  function leave(outcome: FocusOutcome) {
    if (night.session) sessionAfterFocusCheck(night.session, outcome)
    night.notePause()
    if (typeof window === 'undefined') return
    const id = night.session?.id
    window.location.hash = id ? `#/tonight/${id}` : '#/tonight'
  }

  return (
    <div className="tonight">
      {night.error && <p className="error">{night.error}</p>}
      <FocusCheck
        onLeave={leave}
        onDrink={() => night.addDrink(1)}
        onDrinkBatch={() => night.addDrink(2)}
        onHome={() => void night.goHome()}
      />
    </div>
  )
}
