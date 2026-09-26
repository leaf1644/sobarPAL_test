import type { NudgeKind } from '../domain/nudge'
import type { CreateSessionInput, GuardianView, TonightSession } from '../domain/types'

export type SessionResponse = { session: TonightSession; server_now: string }
export type GuardianResponse = { view: GuardianView; server_now: string }

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function createHttpApi(fetchImpl: typeof fetch = fetch) {
  async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetchImpl(path, {
      method: init?.method ?? 'GET',
      headers: { 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new ApiError(payload.error || `request failed (${res.status})`, res.status)
    return payload as T
  }

  return {
    createSession(input: CreateSessionInput) {
      return request<SessionResponse>('/api/sessions', { method: 'POST', body: input })
    },
    getSession(id: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}`)
    },
    markHome(id: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/home`, { method: 'POST', body: {} })
    },
    cancel(id: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} })
    },
    ping(id: string, label: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/ping`, {
        method: 'POST',
        body: { label },
      })
    },
    proposeGuardian(id: string, guardian_name: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/guardian/propose`, {
        method: 'POST',
        body: { guardian_name },
      })
    },
    confirmGuardian(id: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/guardian/confirm`, {
        method: 'POST',
        body: {},
      })
    },
    cancelGuardianChange(id: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/guardian/cancel-change`, {
        method: 'POST',
        body: {},
      })
    },
    dismissNudges(id: string) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/nudges/dismiss`, {
        method: 'POST',
        body: {},
      })
    },
    noteNudge(id: string, kind: NudgeKind) {
      return request<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}/nudges/note`, {
        method: 'POST',
        body: { kind },
      })
    },
    guardianView(token: string) {
      return request<GuardianResponse>(`/api/guardian/${encodeURIComponent(token)}`)
    },
    acceptGuardian(token: string) {
      return request<GuardianResponse>(`/api/guardian/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        body: {},
      })
    },
    advance(minutes: number) {
      return request<{ server_now: string }>('/api/demo/advance', { method: 'POST', body: { minutes } })
    },
    jumpPastGrace(sessionId: string) {
      return request<{ server_now: string }>('/api/demo/jump', { method: 'POST', body: { session_id: sessionId } })
    },
  }
}

export const httpApi = createHttpApi()
