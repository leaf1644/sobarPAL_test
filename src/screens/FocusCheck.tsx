import { useEffect, useState } from 'react'
import { copy, shapeWord } from '../copy'
import { Hero } from './Hero'
import {
  FOCUS_ROUND_SECONDS,
  completeFocusRound,
  logicRound,
  matchRound,
  reactionScript,
  type FocusGame,
  type FocusOutcome,
} from '../domain/focusCheck'

export function FocusCheck({
  onLeave,
  onDrink,
  onDrinkBatch,
  onHome,
}: {
  onLeave: (outcome: FocusOutcome) => void
  onDrink: () => void
  onDrinkBatch: () => void
  onHome: () => void
}) {
  const [game, setGame] = useState<FocusGame>('reaction')
  const [done, setDone] = useState(false)
  const [seed, setSeed] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), FOCUS_ROUND_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [game])

  function finish(correct: boolean) {
    setDone(true)
    void correct
  }

  return (
    <section className="card focus-card" aria-label={copy.focus}>
      <Hero kind="focus" />
      <p className="eyebrow">{copy.focusEyebrow}</p>
      <h2>{copy.focusTitle}</h2>
      <p className="disclaimer">{copy.focusDisclaimer}</p>
      <p className="quiet">{copy.focusNote}</p>
      <div className="game-picks" role="group" aria-label={copy.gamesLabel}>
        {(['reaction', 'match', 'logic'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={item === game ? 'hit choice on' : 'hit choice'}
            onClick={() => {
              setGame(item)
              setSeed((value) => value + 1)
              setDone(false)
            }}
          >
            {item === 'reaction' ? copy.gameReaction : item === 'match' ? copy.gameMatch : copy.gameLogic}
          </button>
        ))}
      </div>
      {done ? (
        <div className="pause-done">
          <p>{copy.pauseDone}</p>
          <button type="button" className="hit" onClick={() => onLeave(completeFocusRound({ game, correct: true }))}>
            {copy.backTonight}
          </button>
        </div>
      ) : game === 'reaction' ? (
        <ReactionGame seed={seed} onDone={() => finish(true)} />
      ) : game === 'match' ? (
        <MatchGame seed={seed} onPick={() => finish(true)} />
      ) : (
        <LogicGame seed={seed} onPick={() => finish(true)} />
      )}
      <NightActions onDrink={onDrink} onDrinkBatch={onDrinkBatch} onHome={onHome} focusCurrent />
    </section>
  )
}

function ReactionGame({ seed, onDone }: { seed: number; onDone: () => void }) {
  const script = reactionScript(seed)
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!started) return
    const timer = window.setTimeout(() => setVisible(true), script.appear_at_ms)
    return () => window.clearTimeout(timer)
  }, [started, script.appear_at_ms])

  return (
    <div className="game">
      <p>{copy.reactionHint}</p>
      {!started && (
        <button type="button" className="hit" onClick={() => setStarted(true)}>
          {copy.start}
        </button>
      )}
      {started && !visible && <p className="quiet">{copy.waitTarget}</p>}
      {visible && (
        <button type="button" className="hit target" onClick={onDone}>
          {copy.tap}
        </button>
      )}
    </div>
  )
}

function MatchGame({ seed, onPick }: { seed: number; onPick: () => void }) {
  const round = matchRound(seed)
  return (
    <div className="game">
      <p>{copy.matchHint}</p>
      <Shape name={round.sample} />
      <div className="shape-row">
        {round.options.map((option, index) => (
          <button key={`${option}-${index}`} type="button" className="hit choice" onClick={onPick}>
            <Shape name={option} />
          </button>
        ))}
      </div>
    </div>
  )
}

function LogicGame({ seed, onPick }: { seed: number; onPick: () => void }) {
  const round = logicRound(seed)
  return (
    <div className="game">
      <p>{copy.logicHint}</p>
      <div className="shape-row">
        {round.sequence.map((shape, index) => (
          <Shape key={`${shape}-${index}`} name={shape} />
        ))}
        <span className="mystery">?</span>
      </div>
      <div className="shape-row">
        {round.choices.map((choice) => (
          <button key={choice} type="button" className="hit choice" onClick={onPick}>
            <Shape name={choice} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Shape({ name }: { name: string }) {
  return <span className={`shape ${name}`}>{shapeWord(name)}</span>
}

export function NightActions({
  onDrink,
  onDrinkBatch,
  onHome,
  onFocus,
  focusCurrent = false,
}: {
  onDrink: () => void
  onDrinkBatch: () => void
  onHome: () => void
  onFocus?: () => void
  focusCurrent?: boolean
}) {
  return (
    <div className="night-actions">
      <button type="button" className="hit drink" onClick={onDrink}>
        {copy.drinkOne}
      </button>
      <button type="button" className="hit drink secondary" onClick={onDrinkBatch}>
        {copy.drinkTwo}
      </button>
      {focusCurrent ? (
        <button type="button" className="hit focus" disabled>
          {copy.focus}
        </button>
      ) : (
        <button type="button" className="hit focus" onClick={onFocus}>
          {copy.focus}
        </button>
      )}
      <button type="button" className="hit home" onClick={onHome}>
        {copy.home}
      </button>
    </div>
  )
}
