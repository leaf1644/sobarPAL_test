import { useEffect, useState } from 'react'
import { shapeLabel } from '../copy'
import {
  FOCUS_DISCLAIMER,
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
  }, [])

  function finish(correct: boolean) {
    setDone(true)
    void correct
  }

  return (
    <section className="card focus-card" aria-label="專注暫停">
      <p className="eyebrow">專注暫停</p>
      <h2>停一下。</h2>
      <p className="disclaimer">{FOCUS_DISCLAIMER}</p>
      <p className="quiet">大約 {FOCUS_ROUND_SECONDS} 秒。可以不做。沒有分數。</p>
      <div className="game-picks" role="group" aria-label="小遊戲">
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
            {item === 'reaction' ? '反應點擊' : item === 'match' ? '配對圖形' : '邏輯圖案'}
          </button>
        ))}
      </div>
      {done ? (
        <div className="pause-done">
          <p>暫停完成。</p>
          <button type="button" className="hit" onClick={() => onLeave(completeFocusRound({ game, correct: true }))}>
            回到今晚
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
      <p>目標出現時再按。</p>
      {!started && (
        <button type="button" className="hit" onClick={() => setStarted(true)}>
          開始
        </button>
      )}
      {started && !visible && <p className="quiet">先等一下，目標還沒出現。</p>}
      {visible && (
        <button type="button" className="hit target" onClick={onDone}>
          點這裡
        </button>
      )}
    </div>
  )
}

function MatchGame({ seed, onPick }: { seed: number; onPick: () => void }) {
  const round = matchRound(seed)
  return (
    <div className="game">
      <p>找出一樣的圖形。</p>
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
      <p>選出下一個圖形。</p>
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
  return <span className={`shape ${name}`}>{shapeLabel(name)}</span>
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
        記一杯
      </button>
      <button type="button" className="hit drink secondary" onClick={onDrinkBatch}>
        再記兩杯
      </button>
      {focusCurrent ? (
        <button type="button" className="hit focus on" disabled>
          專注暫停
        </button>
      ) : (
        <button type="button" className="hit focus" onClick={onFocus}>
          專注暫停
        </button>
      )}
      <button type="button" className="hit home" onClick={onHome}>
        我到家了
      </button>
    </div>
  )
}
