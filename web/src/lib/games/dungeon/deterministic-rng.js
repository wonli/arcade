function partText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return JSON.stringify(value)
}

export function hashSeed(...parts) {
  let hash = 2166136261 >>> 0
  const text = parts.map(partText).join('\u001f')
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFor(runSeed, floor, namespace, key = '') {
  return createSeededRandom(hashSeed(runSeed, Math.max(1, Math.floor(Number(floor) || 1)), namespace, key))
}
