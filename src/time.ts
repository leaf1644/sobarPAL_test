export function defaultCheckInIso(nowMs: number): string {
  return new Date(nowMs + 2 * 60 * 60 * 1000).toISOString()
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('check-in time is invalid')
  return parsed.toISOString()
}
