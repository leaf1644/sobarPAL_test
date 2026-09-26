import { useEffect, useState } from 'react'
import { copy } from './copy'
import { currentHash, parseHash } from './route'
import { GuardianMode } from './screens/GuardianMode'
import { PlanTonight } from './screens/PlanTonight'
import { Tonight } from './screens/Tonight'

type Theme = 'dark' | 'light'

function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark'
  return localStorage.getItem('soberpal.theme') === 'light' ? 'light' : 'dark'
}

export function App({ initialHash }: { initialHash?: string }) {
  const [hash, setHash] = useState(initialHash ?? currentHash())
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    if (initialHash) return
    const onHash = () => setHash(window.location.hash || '#/plan')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [initialHash])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    if (typeof localStorage !== 'undefined') localStorage.setItem('soberpal.theme', theme)
  }, [theme])

  const route = parseHash(hash)

  return (
    <div className="app">
      <button
        type="button"
        className="theme-switch"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? copy.themeToLight : copy.themeToDark}
      </button>
      <header className="top">
        <div>
          <p className="brand">{copy.brand}</p>
          <p className="tagline">{copy.tagline}</p>
        </div>
        <nav className="modes" aria-label={copy.navLabel}>
          <a href="#/plan">{copy.navPlan}</a>
          <a href="#/tonight">{copy.navTonight}</a>
          <a href="#/guardian">{copy.navGuardian}</a>
        </nav>
        <p className="legend">{copy.legend}</p>
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
