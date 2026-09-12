import { adoptLocalPlayerEntity, createPlayerEntity, createPlayerState, destroyPlayerEntity, syncPlayerEntityVisual } from './player-entity.js'
import { applyRemotePlayerState, interpolateRemotePlayer, playerNetworkState } from './multiplayer-state.js'

const SEND_INTERVAL_MS = 50
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
  sendPlayerState = () => {},
} = {}) {
  if (!scene || !localPlayerId || !remotePlayerId) return null
  if (scene.__dungeonMultiplayer) return scene.__dungeonMultiplayer

  const local = adoptLocalPlayerEntity(scene, localPlayerId)
  const localSpawn = coopPlayerSpawn(scene.__roomGeometry, localIndex)
  local.state.x = localSpawn.x
  local.state.y = localSpawn.y
  local.targetX = localSpawn.x
  local.targetY = localSpawn.y
  syncPlayerEntityVisual(scene, local)

  const remoteIndex = localIndex === 0 ? 1 : 0
  const remoteSpawn = coopPlayerSpawn(scene.__roomGeometry, remoteIndex)
  const remote = createPlayerEntity(scene, {
    id: remotePlayerId,
    state: createPlayerState({ x: remoteSpawn.x, y: remoteSpawn.y }),
    local: false,
  })

  let lastSendAt = -Infinity
  let destroyed = false

  const api = {
    local,
    remote,
    receivePlayerState(state) {
      if (destroyed || state?.id !== remotePlayerId) return false
      return applyRemotePlayerState(remote, state)
    },
    update(time = 0, _delta = 16) {
      if (destroyed) return
      interpolateRemotePlayer(remote, REMOTE_LERP)
      syncPlayerEntityVisual(scene, remote)
      if (time - lastSendAt < SEND_INTERVAL_MS) return
      lastSendAt = time
      sendPlayerState(playerNetworkState(local))
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      scene.events?.off?.('update', onUpdate)
      destroyPlayerEntity(scene, remotePlayerId)
      if (scene.__dungeonMultiplayer === api) delete scene.__dungeonMultiplayer
    },
  }

  const onUpdate = (time, delta) => api.update(time, delta)
  scene.events?.on?.('update', onUpdate)
  scene.events?.once?.('shutdown', () => api.destroy())
  scene.__dungeonMultiplayer = api
  return api
}
