const playerKey = 'arcade.playerId'
const sessionKey = 'arcade.sessionId'

function randomId() {
  return crypto.randomUUID()
}

export function getIdentity() {
  let playerId = localStorage.getItem(playerKey)
  if (!playerId) {
    playerId = randomId()
    localStorage.setItem(playerKey, playerId)
  }

  let sessionId = sessionStorage.getItem(sessionKey)
  if (!sessionId) {
    sessionId = randomId()
    sessionStorage.setItem(sessionKey, sessionId)
  }

  return { playerId, sessionId }
}

export function defaultName(playerId) {
  return `PLAYER-${playerId.slice(0, 6).toUpperCase()}`
}
