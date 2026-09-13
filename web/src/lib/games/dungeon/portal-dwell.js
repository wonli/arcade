export const PORTAL_DWELL_MS = 3000

export function portalDwellState(state = {}, { inside = false, now = 0, durationMs = PORTAL_DWELL_MS } = {}) {
  if (!inside) return { enteredAt: null, seconds: null, complete: false }

  const enteredAt = state.enteredAt ?? now
  const elapsed = Math.max(0, now - enteredAt)
  const remaining = Math.max(0, durationMs - elapsed)
  return {
    enteredAt,
    seconds: remaining > 0 ? Math.ceil(remaining / 1000) : 0,
    complete: elapsed >= durationMs,
  }
}
