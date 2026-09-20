const playerKey = 'arcade.playerId'
const sessionKey = 'arcade.sessionId'

function hexByte(value) {
  return value.toString(16).padStart(2, '0')
}

export function randomId(cryptoImpl = globalThis.crypto, random = Math.random, now = Date.now) {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID()

  if (typeof cryptoImpl?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    cryptoImpl.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, hexByte)
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
  }

  const entropy = Array.from({ length: 4 }, () => Math.floor(random() * 0x100000000).toString(16).padStart(8, '0')).join('')
  return `legacy-${now().toString(36)}-${entropy}`
}

function browserStorage(name) {
  try {
    return globalThis?.[name] ?? null
  } catch {
    return null
  }
}

export function getIdentity({ storage = browserStorage('localStorage'), sessionStorage = browserStorage('sessionStorage') } = {}) {
  let playerId = storage?.getItem(playerKey)
  if (!playerId) {
    playerId = randomId()
    storage?.setItem(playerKey, playerId)
  }

  let sessionId = sessionStorage?.getItem(sessionKey)
  if (!sessionId) {
    sessionId = randomId()
    sessionStorage?.setItem(sessionKey, sessionId)
  }

  return { playerId, sessionId }
}

export function defaultName(playerId) {
  return `PLAYER-${playerId.slice(0, 6).toUpperCase()}`
}
