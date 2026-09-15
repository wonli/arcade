export function hashSeed(value) {
  let hash = 2166136261 >>> 0
  for (const character of String(value ?? 'dungeon')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function normalizeRunSeed(runSeed) {
  const value = String(runSeed ?? '').trim()
  return value ? value.toUpperCase() : 'DUNGEON'
}

function normalizeFloor(floor) {
  return Math.max(1, Math.floor(Number(floor) || 1))
}

export function floorSeed(runSeed, floor = 1) {
  return hashSeed(`${normalizeRunSeed(runSeed)}:${normalizeFloor(floor)}`)
}

export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = Math.imul(state ^ state >>> 15, state | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function encodeKeyPart(value) {
  if (value === null) return 'null:0:'
  const type = typeof value
  if (!['string', 'number', 'boolean', 'undefined'].includes(type)) throw new TypeError('Dungeon random keys must be primitive values')
  const text = String(value)
  return `${type}:${text.length}:${text}`
}

export function keyedSeed(runSeed, floor, ...keys) {
  const parts = [normalizeRunSeed(runSeed), normalizeFloor(floor), ...keys].map(encodeKeyPart)
  return hashSeed(parts.join('|'))
}

export function randomFor(runSeed, floor, ...keys) {
  return createSeededRandom(keyedSeed(runSeed, floor, ...keys))()
}
