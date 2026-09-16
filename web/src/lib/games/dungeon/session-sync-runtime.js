export const SESSION_SYNC_PHASE = Object.freeze({
  BOOTSTRAP: 'BOOTSTRAP',
  HYDRATING: 'HYDRATING',
  LIVE: 'LIVE',
  RECONNECTING: 'RECONNECTING',
})

export function createSessionSyncRuntime({ authority = false } = {}) {
  let currentPhase = SESSION_SYNC_PHASE.BOOTSTRAP
  let authorityRole = Boolean(authority)

  function phase() {
    return currentPhase
  }

  function mayPublishSnapshot() {
    return currentPhase === SESSION_SYNC_PHASE.LIVE
  }

  function startFollowerHydration() {
    authorityRole = false
    currentPhase = SESSION_SYNC_PHASE.HYDRATING
    return currentPhase
  }

  function acceptCheckpoint() {
    currentPhase = SESSION_SYNC_PHASE.LIVE
    return currentPhase
  }

  function beginReconnect() {
    currentPhase = SESSION_SYNC_PHASE.RECONNECTING
    return currentPhase
  }

  function takeAuthority() {
    authorityRole = true
    currentPhase = SESSION_SYNC_PHASE.LIVE
    return currentPhase
  }

  function isAuthorityRole() {
    return authorityRole
  }

  return {
    phase,
    mayPublishSnapshot,
    startFollowerHydration,
    acceptCheckpoint,
    beginReconnect,
    takeAuthority,
    isAuthorityRole,
  }
}
