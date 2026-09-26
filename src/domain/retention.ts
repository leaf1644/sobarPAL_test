export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export function isSessionExpired(createdAt: string, nowMs: number): boolean {
  return nowMs - Date.parse(createdAt) >= RETENTION_MS
}

export function shouldClearLocalLog(serverStatus: number): boolean {
  return serverStatus === 404
}
