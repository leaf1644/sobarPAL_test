export type Clock = {
  now(): number
  advance(ms: number): void
  set(ms: number): void
}

export function systemClock(): Clock {
  let offset = 0
  return {
    now: () => Date.now() + offset,
    advance(ms: number) {
      offset += ms
    },
    set(ms: number) {
      offset = ms - Date.now()
    },
  }
}

export function fixedClock(start: number): Clock {
  let time = start
  return {
    now: () => time,
    advance(ms: number) {
      time += ms
    },
    set(ms: number) {
      time = ms
    },
  }
}
