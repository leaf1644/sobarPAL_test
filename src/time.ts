export function defaultCheckInIso(nowMs: number): string {
  return new Date(nowMs + 2 * 60 * 60 * 1000).toISOString()
}

export function toTimeValue(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A clock time for a night out. A time already passed today is the next morning. */
export function tonightUntilIso(timeValue: string, nowMs: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!match) throw new Error('check-in time is invalid')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error('check-in time is invalid')
  const when = new Date(nowMs)
  when.setSeconds(0, 0)
  when.setHours(hours, minutes, 0, 0)
  if (when.getTime() <= nowMs) when.setDate(when.getDate() + 1)
  return when.toISOString()
}

export function isNextMorning(timeValue: string, nowMs: number): boolean {
  return new Date(tonightUntilIso(timeValue, nowMs)).toDateString() !== new Date(nowMs).toDateString()
}

export function formatLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
