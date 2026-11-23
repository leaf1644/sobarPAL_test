export function Hero({ kind }: { kind: 'plan' | 'tonight' | 'focus' | 'guardian' }) {
  return (
    <div className={`hero hero-${kind}`} aria-hidden="true">
      {kind === 'focus' ? <FocusArt /> : kind === 'guardian' ? <GuardianArt /> : <HomeArt night={kind === 'tonight'} />}
    </div>
  )
}

function HomeArt({ night }: { night: boolean }) {
  return (
    <svg viewBox="0 0 320 112">
      <circle cx="250" cy="36" r="16" fill={night ? '#f6e7b2' : '#ef8b3a'} />
      {night && <path d="M258 28a12 12 0 1 0 0 18 10 10 0 1 1 0-18Z" fill="#1f8a70" />}
      <path d="M28 86c28-18 48-18 70 0" fill="none" stroke="#c9b89a" strokeWidth="6" strokeLinecap="round" />
      <rect x="118" y="42" width="78" height="52" rx="10" fill="#fff" />
      <path d="M110 48 157 22l47 26" fill="none" stroke="#ef8b3a" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="148" y="62" width="18" height="32" rx="4" fill="#1f8a70" />
      <circle cx="230" cy="70" r="12" fill="#ffd7b0" />
      <rect x="218" y="82" width="24" height="16" rx="8" fill="#1f8a70" />
    </svg>
  )
}

function FocusArt() {
  return (
    <svg viewBox="0 0 320 112">
      <circle cx="118" cy="56" r="28" fill="#fff" />
      <path d="M110 46v20M126 46v20" stroke="#1f8a70" strokeWidth="5" strokeLinecap="round" />
      <circle cx="190" cy="42" r="14" fill="#ef8b3a" />
      <circle cx="214" cy="70" r="10" fill="#1f8a70" />
      <circle cx="168" cy="74" r="8" fill="#f6e7b2" />
    </svg>
  )
}

function GuardianArt() {
  return (
    <svg viewBox="0 0 320 112">
      <circle cx="132" cy="48" r="14" fill="#ffd7b0" />
      <rect x="116" y="64" width="32" height="22" rx="11" fill="#ef8b3a" />
      <circle cx="188" cy="48" r="14" fill="#ffd7b0" />
      <rect x="172" y="64" width="32" height="22" rx="11" fill="#1f8a70" />
      <path d="M150 58h20" stroke="#1c2823" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
