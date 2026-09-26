import { useEffect, useState } from 'react'
import { currentHash, parseHash } from './route'
import { GuardianMode } from './screens/GuardianMode'
import { PlanTonight } from './screens/PlanTonight'
import { Tonight } from './screens/Tonight'

export function App({ initialHash }: { initialHash?: string }) {
  const [hash, setHash] = useState(initialHash ?? currentHash())

  useEffect(() => {
    if (initialHash) return
    const onHash = () => setHash(window.location.hash || '#/plan')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [initialHash])

  const route = parseHash(hash)

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="brand">SoberPal</p>
          <p className="tagline">People look out for people.</p>
        </div>
        <nav className="modes" aria-label="Modes">
          <a href="#/plan">Plan tonight</a>
          <a href="#/tonight">Tonight</a>
          <a href="#/guardian">Guardian mode</a>
        </nav>
        <p className="legend">Tonight actions: + Drink, Focus Check, and I'm home.</p>
      </header>
      <main>
        {route.name === 'plan' && <PlanTonight />}
        {route.name === 'tonight' && <Tonight sessionId={route.id} />}
        {route.name === 'guardian' && <GuardianMode />}
        {route.name === 'guardian-session' && <GuardianMode token={route.token} />}
      </main>
    </div>
  )
}
