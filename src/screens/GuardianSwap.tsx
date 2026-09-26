import { useState } from 'react'
import { httpApi, messageFrom } from '../client/api'
import { confirmSwapLine, copy } from '../copy'
import type { TonightSession } from '../domain/types'

export function GuardianSwap({
  session,
  onSession,
  onError,
}: {
  session: TonightSession
  onSession: (session: TonightSession) => void
  onError: (message: string) => void
}) {
  const [nextGuardian, setNextGuardian] = useState('')

  async function propose() {
    onError('')
    try {
      const result = await httpApi.proposeGuardian(session.id, nextGuardian)
      onSession(result.session)
    } catch (cause) {
      onError(messageFrom(cause, copy.errSwap))
    }
  }

  async function confirm() {
    onError('')
    try {
      const result = await httpApi.confirmGuardian(session.id)
      onSession(result.session)
      setNextGuardian('')
    } catch (cause) {
      onError(messageFrom(cause, copy.errConfirm))
    }
  }

  async function cancelChange() {
    onError('')
    try {
      const result = await httpApi.cancelGuardianChange(session.id)
      onSession(result.session)
    } catch (cause) {
      onError(messageFrom(cause, copy.errSwap))
    }
  }

  return (
    <div className="stack">
      <label>
        {copy.swapLabel}
        <input value={nextGuardian} onChange={(event) => setNextGuardian(event.target.value)} />
      </label>
      <button type="button" className="hit secondary" onClick={() => void propose()}>
        {copy.swapButton}
      </button>
      {session.pending_guardian_name && (
        <div className="confirm">
          <p>{confirmSwapLine(session.pending_guardian_name)}</p>
          <button type="button" className="hit" onClick={() => void confirm()}>
            {copy.confirmSwapButton}
          </button>
          <button type="button" className="hit secondary" onClick={() => void cancelChange()}>
            {copy.cancelSwap}
          </button>
        </div>
      )}
    </div>
  )
}
