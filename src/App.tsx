import { useEffect, useState } from 'react'
import { copy } from './copy'
import { currentHash, parseHash } from './route'
import { FocusNight } from './screens/FocusNight'
import { GuardianMode } from './screens/GuardianMode'
import { PlanTonight } from './screens/PlanTonight'
import { Tonight } from './screens/Tonight'

type Theme = 'dark' | 'light'

function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark'
  return localStorage.getItem('soberpal.theme') === 'light' ? 'light' : 'dark'
}

export function App({ initialHash, initialTheme }: { initialHash?: string; initialTheme?: Theme }) {
  const [hash, setHash] = useState(initialHash ?? currentHash())
  const [theme, setTheme] = useState<Theme>(initialTheme ?? readTheme)

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
        {route.name !== 'guardian-session' && (
          <nav className="modes" aria-label={copy.navLabel}>
            <a href="#/plan">{copy.navPlan}</a>
            <a href="#/tonight">{copy.navTonight}</a>
            <a href="#/focus">{copy.navFocus}</a>
          </nav>
        )}
        {route.name !== 'guardian-session' && <p className="legend">{copy.legend}</p>}
      </header>
      <main>
        {(route.name === 'plan' || route.name === 'guardian') && <PlanTonight />}
        {route.name === 'tonight' && <Tonight sessionId={route.id} />}
        {route.name === 'focus' && <FocusNight sessionId={route.id} />}
        {route.name === 'guardian-session' && <GuardianMode token={route.token} />}
      </main>
    </div>
  )
}
