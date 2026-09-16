import { consumeRemainingDuration, nextAuthority } from './session-authority.js'

const SESSION_STATUSES = new Set(['playing', 'wiped', 'complete'])
const PLAYER_LIFECYCLE_STATUSES = new Set(['alive', 'downed', 'respawning'])

function clone(value) {
  return structuredClone(value ?? {})
}

function requireText(value, label) {
  const text = String(value ?? '').trim()
  if (!text) throw new TypeError(`Dungeon ${label} is required`)
  return text
}

function safeInteger(value, { min = 0 } = {}) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min) return null
  return number
}

function normalizeAuthority(authority) {
  const epoch = safeInteger(authority?.epoch, { min: 1 })
  const sequence = safeInteger(authority?.sequence)
  const authorityId = String(authority?.authorityId ?? '').trim()
  if (epoch == null || sequence == null || !authorityId) {
    throw new TypeError('Dungeon checkpoint authority is invalid')
  }
  return { epoch, authorityId, sequence }
}

function normalizeLifecycleEntry(entry = {}) {
  const status = String(entry.status ?? 'alive')
  if (!PLAYER_LIFECYCLE_STATUSES.has(status)) {
    throw new TypeError(`Invalid Dungeon player lifecycle status: ${status}`)
  }
  const duration = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0)
  return {
    status,
    respawnRemainingMs: duration(entry.respawnRemainingMs),
    invulnerabilityRemainingMs: duration(entry.invulnerabilityRemainingMs),
  }
}

function normalizeRecord(record = {}, mapper = clone) {
  const result = {}
  for (const key of Object.keys(record ?? {}).sort()) {
    const id = String(key).trim()
    if (!id) continue
    result[id] = mapper(record[key], id)
  }
  return result
}

export function createSessionCheckpoint(input = {}) {
  const roomId = requireText(input.roomId, 'room id').toUpperCase()
  const runSeed = requireText(input.runSeed, 'run seed').toUpperCase()
  const status = String(input.status ?? 'playing')
  if (!SESSION_STATUSES.has(status)) throw new TypeError(`Invalid Dungeon session status: ${status}`)

  const openedChestIds = [...new Set(
    (Array.isArray(input.openedChestIds) ? input.openedChestIds : [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  )].sort()

  return {
    version: 1,
    roomId,
    runSeed,
    authority: normalizeAuthority(input.authority),
    status,
    world: clone(input.world),
    players: normalizeRecord(input.players),
    lifecycle: normalizeRecord(input.lifecycle, normalizeLifecycleEntry),
    openedChestIds,
  }
}

function compareCheckpointAuthority(current, candidate) {
  if (!current) return 1
  const a = current.authority
  const b = candidate.authority
  if (b.epoch !== a.epoch) return b.epoch > a.epoch ? 1 : -1
  if (b.authorityId !== a.authorityId) return -1
  if (b.sequence === a.sequence) return 0
  return b.sequence > a.sequence ? 1 : -1
}

function consumeLifecycle(checkpoint, elapsedMs) {
  const next = createSessionCheckpoint(checkpoint)
  const elapsed = Math.max(0, Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0)
  for (const lifecycle of Object.values(next.lifecycle)) {
    lifecycle.respawnRemainingMs = consumeRemainingDuration(lifecycle.respawnRemainingMs, elapsed)
    lifecycle.invulnerabilityRemainingMs = consumeRemainingDuration(lifecycle.invulnerabilityRemainingMs, elapsed)
  }
  return next
}

export function createDungeonSessionRuntime({ now = () => performance.now() } = {}) {
  if (typeof now !== 'function') throw new TypeError('Dungeon session clock is required')

  let checkpoint = null
  let observedAt = 0

  function currentTime() {
    const value = Number(now())
    return Number.isFinite(value) ? value : 0
  }

  function materialize() {
    if (!checkpoint) return null
    return consumeLifecycle(checkpoint, Math.max(0, currentTime() - observedAt))
  }

  function applyCheckpoint(value) {
    if (!value || typeof value !== 'object') return false
    let candidate
    try {
      candidate = createSessionCheckpoint(value)
    } catch {
      return false
    }
    if (compareCheckpointAuthority(checkpoint, candidate) <= 0) return false
    checkpoint = candidate
    observedAt = currentTime()
    return true
  }

  function snapshot() {
    return materialize()
  }

  function takeAuthority(authorityId) {
    const current = materialize()
    if (!current) throw new Error('Dungeon session checkpoint is required before authority takeover')
    current.authority = nextAuthority(current.authority, authorityId)
    checkpoint = createSessionCheckpoint(current)
    observedAt = currentTime()
    return createSessionCheckpoint(checkpoint)
  }

  return {
    applyCheckpoint,
    snapshot,
    takeAuthority,
  }
}
