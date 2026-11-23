import { useEffect, useState } from 'react'
import { copy } from './copy'
import { currentHash, parseHash } from './route'
import { FocusNight } from './screens/FocusNight'
import { GuardianMode } from './screens/GuardianMode'
import { PlanTonight } from './screens/PlanTonight'
import { Tonight } from './screens/Tonight'

type Theme = 'dark' | 'light'

function helpFor(name: ReturnType<typeof parseHash>['name']): readonly string[] {
  if (name === 'tonight') return copy.helpTonight
  if (name === 'focus') return copy.helpFocus
  if (name === 'guardian-session') return copy.helpGuardian
  return copy.helpPlan
}

function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light'
  return localStorage.getItem('soberpal.theme') === 'dark' ? 'dark' : 'light'
}

function TabIcon({ kind }: { kind: 'plan' | 'tonight' | 'focus' }) {
  if (kind === 'plan') {
    return (
      <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-5.2h-3.6V21H5a1 1 0 0 1-1-1v-9.5Z" fill="currentColor" />
      </svg>
    )
  }
  if (kind === 'tonight') {
    return (
      <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 3.2a8.2 8.2 0 1 0 6.3 13.2 7 7 0 0 1-6.3-13.2Z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9v6M14 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function App({ initialHash, initialTheme }: { initialHash?: string; initialTheme?: Theme }) {
  const [hash, setHash] = useState(initialHash ?? currentHash())
  const [theme, setTheme] = useState<Theme>(initialTheme ?? readTheme)

  useEffect(() => {
    if (initialHash) return
    const onHash = () => {
      setHash(window.location.hash || '#/plan')
      window.scrollTo(0, 0)
    }
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
      <header className="top">
        <div className="brand-row">
          <span className="mark" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <rect width="36" height="36" rx="12" fill="currentColor" />
              <path d="M10 20.5 18 13l8 7.5V26a1 1 0 0 1-1 1h-5.2v-4.2h-3.6V27H11a1 1 0 0 1-1-1v-5.5Z" fill="#fff8ef" />
            </svg>
          </span>
          <div className="brand-copy">
            <p className="brand">{copy.brand}</p>
            <p className="tagline">{copy.tagline}</p>
          </div>
          <button
            type="button"
            className="theme-switch"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? copy.themeToLight : copy.themeToDark}
          </button>
        </div>
        {route.name !== 'guardian-session' && <p className="legend">{copy.legend}</p>}
        <details className="help">
          <summary>{copy.helpSummary}</summary>
          <ol>
            {helpFor(route.name).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      </header>
      <main>
        {(route.name === 'plan' || route.name === 'guardian') && <PlanTonight />}
        {route.name === 'tonight' && <Tonight sessionId={route.id} />}
        {route.name === 'focus' && <FocusNight sessionId={route.id} />}
        {route.name === 'guardian-session' && <GuardianMode token={route.token} />}
      </main>
      {route.name !== 'guardian-session' && (
        <nav className="modes" aria-label={copy.navLabel}>
          <a href="#/plan" aria-current={route.name === 'plan' || route.name === 'guardian' ? 'page' : undefined}>
            <TabIcon kind="plan" />
            <span>{copy.navPlan}</span>
          </a>
          <a href="#/tonight" aria-current={route.name === 'tonight' ? 'page' : undefined}>
            <TabIcon kind="tonight" />
            <span>{copy.navTonight}</span>
          </a>
          <a href="#/focus" aria-current={route.name === 'focus' ? 'page' : undefined}>
            <TabIcon kind="focus" />
            <span>{copy.navFocus}</span>
          </a>
        </nav>
      )}
    </div>
  )
}
