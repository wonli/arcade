const listeners = new Set()
let current = { phase: 'idle', game: '', error: '' }

export function setReplayStatus(next) {
  current = { phase: 'idle', game: '', error: '', ...next }
  for (const listener of listeners) listener(current)
}

export function getReplayStatus() { return current }

export function subscribeReplayStatus(listener) {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}
