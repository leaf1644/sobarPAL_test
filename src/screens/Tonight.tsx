import { useState } from 'react'
import { groupedVisibleLogs, loggedAtLeast } from '../domain/log'
import { copy, drinkWord, loggedLine, logWord, nudgeText, statusLabel } from '../copy'
import { magicLinkFromPage } from '../route'
import { CopyLink } from './CopyLink'
import { Hero } from './Hero'
import { NightActions } from './FocusCheck'
import { GuardianSwap } from './GuardianSwap'
import { useDrinkerNight } from './useDrinkerNight'

export function CancelTonight({
  pending,
  onAsk,
  onConfirm,
  onBack,
}: {
  pending: boolean
  onAsk: () => void
  onConfirm: () => void
  onBack: () => void
}) {
  if (!pending) {
    return (
      <button type="button" className="hit secondary" onClick={onAsk}>
        {copy.cancelTonight}
      </button>
    )
  }
  return (
    <div className="confirm">
      <p>{copy.cancelWarn}</p>
      <button type="button" className="hit" onClick={onConfirm}>
        {copy.confirmCancel}
      </button>
      <button type="button" className="hit secondary" onClick={onBack}>
        {copy.cancelSwap}
      </button>
    </div>
  )
}

export function Tonight({ sessionId }: { sessionId?: string }) {
  const night = useDrinkerNight(sessionId)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const session = night.session
  const link =
    session && typeof window !== 'undefined' ? magicLinkFromPage(window.location.href, session.magic_token) : ''

  return (
    <div className="tonight">
      {session?.needs_ok_prompt && (
        <p className="banner sticky" data-testid="are-you-ok">
          {copy.areYouOk}
        </p>
      )}
      <section className="card">
        <Hero kind="tonight" />
        <p className="eyebrow">{copy.tonightEyebrow}</p>
        <h2>{copy.tonightTitle}</h2>
        {session ? (
          <p>
            {copy.statusPrefix}：<strong data-testid="session-status">{statusLabel(session.status)}</strong>
          </p>
        ) : (
          <p>{copy.needPlan}</p>
        )}
        {session && (
          <p className="quiet">
            {session.drinker_name} · {copy.guardian} {session.guardian_name}
            {session.guardian_accepted ? ` · ${copy.connected}` : ` · ${copy.waiting}`} · {copy.limitShort}{' '}
            {session.personal_limit_serves} {copy.cups} {drinkWord(session.primary_drink_type)}
          </p>
        )}
        {session?.status === 'home' && <p className="banner">{copy.homeDone}</p>}
        <p data-testid="logged-at-least">{loggedLine(loggedAtLeast(night.events))}</p>
        <p className="quiet">{copy.logHint}</p>
        {night.banner && (
          <div className="banner" data-testid="nudge-banner">
            <p>{nudgeText(night.banner)}</p>
            <button type="button" className="hit" onClick={night.addWater}>
              {copy.water}
            </button>
            <button type="button" className="hit secondary" onClick={night.hideBanner}>
              {copy.notNow}
            </button>
            <button type="button" className="hit secondary" onClick={() => void night.dismiss()}>
              {copy.dismiss}
            </button>
          </div>
        )}
        <NightActions
          onDrink={() => night.addDrink(1)}
          onDrinkBatch={() => night.addDrink(2)}
          onFocus={night.openFocus}
          onHome={() => void night.goHome()}
        />
        <button type="button" className="hit water" onClick={night.addWater}>
          {copy.water}
        </button>
        <ul className="log-list">
          {groupedVisibleLogs(night.events).map((group) => (
            <li key={group.kind}>
              <span>
                {logWord(group.kind)} {group.total} {copy.cups}
              </span>
              <button type="button" className="hit tiny" onClick={() => night.undo(group.latestId)}>
                {copy.undo}
              </button>
            </li>
          ))}
        </ul>
        {session && link && (
          <div className="block">
            <h3>{copy.linkLabel}</h3>
            <p className="quiet">{copy.linkHint}</p>
            <CopyLink value={link} />
          </div>
        )}
        {session?.status === 'active' && session.guardian_accepted && session.share_location && (
          <div className="block">
            <label>
              {copy.pingLabel}
              <input value={night.ping} onChange={(event) => night.setPing(event.target.value)} placeholder={copy.pingPlaceholder} />
            </label>
            <button type="button" className="hit" onClick={() => void night.sharePing()}>
              {copy.pingButton}
            </button>
            <p className="quiet">{copy.pingHint}</p>
          </div>
        )}
        {session && session.status !== 'home' && session.status !== 'cancelled' && !import.meta.env.PROD && (
          <details className="demo-clock">
            <summary>{copy.demoClock}</summary>
            <p className="quiet">{copy.clockHint}</p>
            <button type="button" className="hit secondary" onClick={() => void night.advance(15)}>
              {copy.plusFifteen}
            </button>
            <button type="button" className="hit secondary" onClick={() => void night.jump()}>
              {copy.pastGrace}
            </button>
          </details>
        )}
        {session && session.status !== 'home' && session.status !== 'cancelled' && (
          <div className="block">
            <GuardianSwap session={session} onSession={night.setSession} onError={night.setError} />
            <CancelTonight
              pending={confirmingCancel}
              onAsk={() => setConfirmingCancel(true)}
              onConfirm={() => void night.cancelTonight()}
              onBack={() => setConfirmingCancel(false)}
            />
          </div>
        )}
        {night.error && <p className="error">{night.error}</p>}
      </section>
    </div>
  )
}
