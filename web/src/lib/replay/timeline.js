export function createRollingTimeline({ windowMs = 20_000, now = () => Date.now() } = {}) {
  let entries = []

  function trim(current = now()) {
    const cutoff = current - windowMs
    entries = entries.filter((entry) => entry.at >= cutoff)
  }

  return {
    push(value, at = now()) {
      entries.push({ at, value })
      trim(at)
    },
    snapshot() {
      const current = now()
      trim(current)
      if (!entries.length) return { durationMs: 0, entries: [] }
      const start = entries[0].at
      const mapped = entries.map((entry) => ({ t: Math.max(0, entry.at - start), value: structuredCloneSafe(entry.value) }))
      const last = entries[entries.length - 1].at
      return { durationMs: Math.max(1, last - start), entries: mapped }
    },
    reset() { entries = [] },
    size() { trim(); return entries.length },
  }
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}
