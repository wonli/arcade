import { adoptLocalPlayerEntity, createPlayerEntity, createPlayerState, destroyPlayerEntity, syncPlayerEntityVisual } from './player-entity.js'
import { applyRemotePlayerState, interpolateRemotePlayer, playerNetworkState } from './multiplayer-state.js'

const SEND_INTERVAL_MS = 300
const REMOTE_LERP = 0.32

export function coopPlayerSpawn(geometry, playerIndex = 0) {
  const base = geometry?.spawn ?? { x: 480, y: 300 }
  if (playerIndex <= 0) return { x: base.x, y: base.y }
  const width = geometry?.width ?? 960
  const offset = base.x + 36 <= width - 48 ? 36 : -36
  return { x: base.x + offset, y: base.y }
}

export function installDungeonMultiplayer(scene, {
  localPlayerId,
  remotePlayerId,
  localIndex = 0,
  localSpawn = null,
  spawnAtRemoteOnFirstState = false,
  sendPlayerState = () => {},
} = {}) {
  if (!scene || !localPlayerId || !remotePlayerId) return null
  if (scene.__dungeonMultiplayer) return scene.__dungeonMultiplayer

  const local = adoptLocalPlayerEntity(scene, localPlayerId)
  const initialLocalSpawn = Number.isFinite(Number(localSpawn?.x)) && Number.isFinite(Number(localSpawn?.y)) ? localSpawn : coopPlayerSpawn(scene.__roomGeometry, localIndex)
  local.state.x = initialLocalSpawn.x
  local.state.y = initialLocalSpawn.y
  local.targetX = initialLocalSpawn.x
  local.targetY = initialLocalSpawn.y
  syncPlayerEntityVisual(scene, local)

  const remoteIndex = localIndex === 0 ? 1 : 0
  const remoteSpawn = coopPlayerSpawn(scene.__roomGeometry, remoteIndex)
  let currentRemotePlayerId = remotePlayerId
  let remote = createPlayerEntity(scene, {
    id: remotePlayerId,
    state: createPlayerState({ x: remoteSpawn.x, y: remoteSpawn.y }),
    local: false,
  })

  let lastSendAt = -Infinity
  let destroyed = false
  let waitingForRemoteSpawn = spawnAtRemoteOnFirstState

  const api = {
    local,
    remote,
    receivePlayerState(state) {
      if (destroyed || !remote || state?.id !== currentRemotePlayerId) return false
      if (waitingForRemoteSpawn) {
        waitingForRemoteSpawn = false
        local.state.x = state.x
        local.state.y = state.y
        local.targetX = state.x
        local.targetY = state.y
        syncPlayerEntityVisual(scene, local)
      }
      return applyRemotePlayerState(remote, state)
    },
    removeRemotePlayer() {
      if (destroyed || !remote) return false
      destroyPlayerEntity(scene, currentRemotePlayerId)
      remote = null
      this.remote = null
      return true
    },
    replaceRemotePlayer(nextRemotePlayerId) {
      if (destroyed || !nextRemotePlayerId || nextRemotePlayerId === local.id) return null
      this.removeRemotePlayer()
      currentRemotePlayerId = nextRemotePlayerId
      remote = createPlayerEntity(scene, {
        id: currentRemotePlayerId,
        state: createPlayerState({ x: local.state.x, y: local.state.y }),
        local: false,
      })
      this.remote = remote
      sendPlayerState(playerNetworkState(local))
      return remote
    },
    update(time = 0, _delta = 16) {
      if (destroyed) return
      if (remote) {
        interpolateRemotePlayer(remote, REMOTE_LERP)
        syncPlayerEntityVisual(scene, remote)
      }
      if (time - lastSendAt < SEND_INTERVAL_MS) return
      lastSendAt = time
      sendPlayerState(playerNetworkState(local))
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      scene.events?.off?.('update', onUpdate)
      if (remote) destroyPlayerEntity(scene, currentRemotePlayerId)
      if (scene.__dungeonMultiplayer === api) delete scene.__dungeonMultiplayer
    },
  }

  const onUpdate = (time, delta) => api.update(time, delta)
  scene.events?.on?.('update', onUpdate)
  scene.events?.once?.('shutdown', () => api.destroy())
  scene.__dungeonMultiplayer = api
  return api
}
