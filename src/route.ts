export type Route =
  | { name: 'plan' }
  | { name: 'tonight'; id?: string }
  | { name: 'guardian' }
  | { name: 'guardian-session'; token: string }

export function parseHash(hash: string): Route {
  const cleaned = (hash.startsWith('#') ? hash.slice(1) : hash).split('?')[0] || '/plan'
  const parts = cleaned.split('/').filter(Boolean)
  if (parts[0] === 'g' && parts[1]) {
    return { name: 'guardian-session', token: decodeURIComponent(parts[1]) }
  }
  if (parts[0] === 'tonight') return { name: 'tonight', id: parts[1] }
  if (parts[0] === 'guardian') return { name: 'guardian' }
  return { name: 'plan' }
}

export function magicLinkFromPage(pageUrl: string, token: string): string {
  const url = new URL(pageUrl)
  url.hash = `/g/${encodeURIComponent(token)}`
  return url.toString()
}

export function currentHash(): string {
  if (typeof window === 'undefined') return '#/plan'
  return window.location.hash || '#/plan'
}
