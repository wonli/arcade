export const COOP_RESPAWN_MS = 3000
export const COOP_INVULNERABILITY_MS = 1500

function normalizeEntry(entry = {}) {
  const status = entry.status === 'downed' ? 'downed' : 'alive'
  return {
    status,
    respawnRemainingMs: status === 'downed' ? Math.max(0, Number(entry.respawnRemainingMs) || 0) : 0,
    invulnerabilityRemainingMs: status === 'alive' ? Math.max(0, Number(entry.invulnerabilityRemainingMs) || 0) : 0,
  }
}

export function createCoopLifecycle(playerIds = []) {
  return Object.fromEntries([...new Set(playerIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    .map((id) => [id, normalizeEntry({ status: 'alive' })]))
}

export function downPlayer(lifecycle = {}, playerId) {
  const id = String(playerId ?? '').trim()
  if (!id) throw new TypeError('playerId is required')
  const next = structuredClone(lifecycle)
  next[id] = {
    status: 'downed',
    respawnRemainingMs: COOP_RESPAWN_MS,
    invulnerabilityRemainingMs: 0,
  }
  const entries = Object.values(next)
  return {
    lifecycle: next,
    partyWiped: entries.length >= 2 && entries.every((entry) => entry?.status === 'downed'),
  }
}

export function advanceCoopLifecycle(lifecycle = {}, elapsedMs = 0, { partyWiped = false } = {}) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const next = {}
  const revived = []

  for (const [id, raw] of Object.entries(lifecycle)) {
    const entry = normalizeEntry(raw)
    if (entry.status === 'downed') {
      if (partyWiped) {
        next[id] = entry
        continue
      }
      const remaining = Math.max(0, entry.respawnRemainingMs - elapsed)
      if (remaining === 0) {
        next[id] = {
          status: 'alive',
          respawnRemainingMs: 0,
          invulnerabilityRemainingMs: COOP_INVULNERABILITY_MS,
        }
        revived.push(id)
      } else next[id] = { ...entry, respawnRemainingMs: remaining }
      continue
    }

    next[id] = {
      ...entry,
      invulnerabilityRemainingMs: Math.max(0, entry.invulnerabilityRemainingMs - elapsed),
    }
  }

  return { lifecycle: next, revived }
}
