import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { DomainError } from '../domain/errors'
import type { NudgeKind } from '../domain/nudge'
import type { CreateSessionInput } from '../domain/types'
import type { SessionStore } from './sessionStore'

type Route = { name: string; params: Record<string, string> }

const ROUTES: { method: string; re: RegExp; name: string; keys: string[] }[] = [
  { method: 'GET', re: /^\/api\/health$/, name: 'health', keys: [] },
  { method: 'POST', re: /^\/api\/sessions$/, name: 'create', keys: [] },
  { method: 'GET', re: /^\/api\/sessions\/([^/]+)$/, name: 'get', keys: ['id'] },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/home$/, name: 'home', keys: ['id'] },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/cancel$/, name: 'cancel', keys: ['id'] },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/ping$/, name: 'ping', keys: ['id'] },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/guardian\/propose$/, name: 'propose', keys: ['id'] },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/guardian\/confirm$/, name: 'confirm', keys: ['id'] },
  {
    method: 'POST',
    re: /^\/api\/sessions\/([^/]+)\/guardian\/cancel-change$/,
    name: 'cancel-change',
    keys: ['id'],
  },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/nudges\/dismiss$/, name: 'dismiss', keys: ['id'] },
  { method: 'POST', re: /^\/api\/sessions\/([^/]+)\/nudges\/note$/, name: 'note', keys: ['id'] },
  { method: 'GET', re: /^\/api\/guardian\/([^/]+)$/, name: 'guardian', keys: ['token'] },
  { method: 'POST', re: /^\/api\/guardian\/([^/]+)\/accept$/, name: 'accept', keys: ['token'] },
  { method: 'POST', re: /^\/api\/demo\/advance$/, name: 'advance', keys: [] },
  { method: 'POST', re: /^\/api\/demo\/jump$/, name: 'jump', keys: [] },
]

export function createApiHandler(store: SessionStore) {
  return async function handle(req: IncomingMessage, res: ServerResponse) {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors())
        res.end()
        return
      }
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const route = matchRoute(req.method ?? 'GET', url.pathname)
      if (!route) {
        send(res, 404, { error: 'not found' })
        return
      }
      const body = req.method === 'POST' ? await readJson(req) : {}
      const result = dispatch(store, route, body)
      send(res, 200, result)
    } catch (error) {
      if (error instanceof DomainError) {
        send(res, error.status, { error: error.message })
        return
      }
      if (error instanceof SyntaxError) {
        send(res, 400, { error: 'invalid JSON' })
        return
      }
      send(res, 500, { error: 'internal error' })
    }
  }
}

export function startApiServer(
  store: SessionStore,
  port = 0,
): Promise<{ url: string; close: () => Promise<void> }> {
  const handle = createApiHandler(store)
  const server = createServer((req, res) => {
    void handle(req, res)
  })
  const timer = setInterval(() => store.watchdogTick(), 5000)
  timer.unref()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('no port'))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, fail) => {
            clearInterval(timer)
            server.close((error) => (error ? fail(error) : done()))
          }),
      })
    })
  })
}

function dispatch(store: SessionStore, route: Route, body: Record<string, unknown>) {
  const tick = () => store.watchdogTick(store.now())
  const envelope = <T extends Record<string, unknown>>(extra: T) => ({ ...extra, server_now: new Date(store.now()).toISOString() })

  switch (route.name) {
    case 'health':
      return { ok: true }
    case 'create': {
      const session = store.create(createInput(body))
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'get': {
      tick()
      const session = store.getSnapshot(route.params.id)
      if (!session) throw new DomainError('session not found', 404)
      return envelope({ session })
    }
    case 'home': {
      const session = store.markHome(route.params.id)
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'cancel': {
      const session = store.cancel(route.params.id)
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'ping': {
      const session = store.recordPing(route.params.id, str(body, 'label'))
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'propose': {
      const session = store.proposeGuardian(route.params.id, str(body, 'guardian_name'))
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'confirm': {
      const session = store.confirmGuardian(route.params.id)
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'cancel-change': {
      const session = store.cancelGuardianChange(route.params.id)
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'dismiss': {
      const session = store.dismissNudges(route.params.id)
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'note': {
      const session = store.noteNudge(route.params.id, nudgeKind(body.kind))
      tick()
      return envelope({ session: store.getSnapshot(session.id) })
    }
    case 'guardian': {
      tick()
      return envelope({ view: store.guardianView(route.params.token) })
    }
    case 'accept': {
      store.acceptByToken(route.params.token)
      tick()
      return envelope({ view: store.guardianView(route.params.token) })
    }
    case 'advance': {
      const minutes = num(body, 'minutes')
      store.advance(minutes)
      return { server_now: new Date(store.now()).toISOString() }
    }
    case 'jump': {
      store.jumpPastGrace(str(body, 'session_id'))
      return { server_now: new Date(store.now()).toISOString() }
    }
    default:
      throw new DomainError('not found', 404)
  }
}

function createInput(body: Record<string, unknown>): CreateSessionInput {
  const input: CreateSessionInput = {
    drinker_name: str(body, 'drinker_name'),
    guardian_name: str(body, 'guardian_name'),
    check_in_at: str(body, 'check_in_at'),
    personal_limit_serves: num(body, 'personal_limit_serves'),
    primary_drink_type: str(body, 'primary_drink_type'),
    share_location: bool(body, 'share_location', false),
    meds_confirmed: bool(body, 'meds_confirmed', false),
  }
  if (typeof body.drinker_id === 'string' && body.drinker_id.trim()) input.drinker_id = body.drinker_id.trim()
  if (body.grace_minutes != null) input.grace_minutes = num(body, 'grace_minutes')
  return input
}

function matchRoute(method: string, pathname: string): Route | null {
  for (const route of ROUTES) {
    if (route.method !== method) continue
    const matched = route.re.exec(pathname)
    if (!matched) continue
    const params: Record<string, string> = {}
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(matched[index + 1])
    })
    return { name: route.name, params }
  }
  return null
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DomainError('expected object')
  }
  return parsed as Record<string, unknown>
}

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (typeof value !== 'string' || !value.trim()) throw new DomainError(`${key} is required`)
  return value.trim()
}

function num(body: Record<string, unknown>, key: string): number {
  const value = body[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new DomainError(`${key} is required`)
  return value
}

function bool(body: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = body[key]
  if (value == null) return fallback
  if (typeof value !== 'boolean') throw new DomainError(`${key} must be boolean`)
  return value
}

function nudgeKind(value: unknown): NudgeKind {
  if (value === 'water' || value === 'heading_home') return value
  throw new DomainError('kind is invalid')
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, cors())
  res.end(JSON.stringify(body))
}

function cors(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json; charset=utf-8',
  }
}
