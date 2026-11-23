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

export function createApiHandler(store: SessionStore, options?: { demo?: boolean }) {
  const demo = options?.demo !== false
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
      if (!demo && (route.name === 'advance' || route.name === 'jump')) {
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
  switch (route.name) {
    case 'health':
      return { ok: true }
    case 'create':
      return sessionBody(store, store.create(createInput(body)).id)
    case 'get':
      return sessionBody(store, route.params.id)
    case 'home':
      store.markHome(route.params.id)
      return sessionBody(store, route.params.id)
    case 'cancel':
      store.cancel(route.params.id)
      return sessionBody(store, route.params.id)
    case 'ping':
      store.recordPing(route.params.id, str(body, 'label'))
      return sessionBody(store, route.params.id)
    case 'propose':
      store.proposeGuardian(route.params.id, str(body, 'guardian_name'))
      return sessionBody(store, route.params.id)
    case 'confirm':
      store.confirmGuardian(route.params.id)
      return sessionBody(store, route.params.id)
    case 'cancel-change':
      store.cancelGuardianChange(route.params.id)
      return sessionBody(store, route.params.id)
    case 'dismiss':
      store.dismissNudges(route.params.id)
      return sessionBody(store, route.params.id)
    case 'note':
      store.noteNudge(route.params.id, nudgeKind(body.kind))
      return sessionBody(store, route.params.id)
    case 'guardian':
      return viewBody(store, route.params.token)
    case 'accept':
      store.acceptByToken(route.params.token)
      return viewBody(store, route.params.token)
    case 'advance': {
      const minutes = num(body, 'minutes')
      const id = optionalStr(body, 'session_id')
      if (id) {
        store.advanceSession(id, minutes)
        return sessionBody(store, id)
      }
      store.advance(minutes)
      return { server_now: stamp(store) }
    }
    case 'jump': {
      const id = str(body, 'session_id')
      store.jumpPastGrace(id)
      return sessionBody(store, id)
    }
    default:
      throw new DomainError('not_found', 404)
  }
}

function sessionBody(store: SessionStore, id: string) {
  store.watchdogTick(store.now())
  const session = store.getSnapshot(id)
  if (!session) throw new DomainError('session_not_found', 404)
  return { session, server_now: stamp(store) }
}

function viewBody(store: SessionStore, token: string) {
  store.watchdogTick(store.now())
  return { view: store.guardianView(token), server_now: stamp(store) }
}

function stamp(store: SessionStore): string {
  return new Date(store.now()).toISOString()
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
    throw new DomainError('expected_object')
  }
  return parsed as Record<string, unknown>
}

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (typeof value !== 'string' || !value.trim()) throw new DomainError(`${key}_required`)
  return value.trim()
}

function optionalStr(body: Record<string, unknown>, key: string): string | null {
  const value = body[key]
  if (value == null || value === '') return null
  return str(body, key)
}

function num(body: Record<string, unknown>, key: string): number {
  const value = body[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new DomainError(`${key}_required`)
  return value
}

function bool(body: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = body[key]
  if (value == null) return fallback
  if (typeof value !== 'boolean') throw new DomainError(`${key}_boolean`)
  return value
}

function nudgeKind(value: unknown): NudgeKind {
  if (value === 'water' || value === 'heading_home') return value
  throw new DomainError('kind_invalid')
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
