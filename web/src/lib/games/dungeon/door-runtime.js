import { nearestInteractable } from './interactables.js'

const DEFAULT_DOOR_RANGE = 48

export function createDungeonDoorRuntime({
  scene,
  getDoors = () => [],
  onOpened = () => {},
  range = DEFAULT_DOOR_RANGE,
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')

  const doorById = doorId => {
    const id = String(doorId ?? '').trim()
    if (!id) return null
    return (getDoors() ?? []).find(door => String(door?.id ?? '') === id) ?? null
  }

  const openById = (player, doorId) => {
    const id = String(doorId ?? '').trim()
    const door = doorById(id)
    if (!door) return { opened: false, reason: 'door-not-found', doorId: id }
    if (door.opened) return { opened: false, reason: 'already-opened', doorId: id }
    if (!player || player.dead || Number(player.state?.hp ?? 0) <= 0) {
      return { opened: false, reason: 'player-dead', doorId: id }
    }
    const distance = Math.hypot(
      Number(door.x ?? 0) - Number(player.state?.x ?? 0),
      Number(door.y ?? 0) - Number(player.state?.y ?? 0),
    )
    if (distance > range) return { opened: false, reason: 'out-of-range', doorId: id }

    door.opened = true
    const event = { type: 'dooropen', doorId: id, playerId: String(player.id ?? '') }
    try { onOpened(event, door) } catch {}
    return { opened: true, doorId: id, event }
  }

  const openNearest = player => {
    const door = nearestInteractable(player?.state, getDoors() ?? [], range)
    if (!door) return { opened: false, reason: 'door-not-found' }
    return openById(player, door.id)
  }

  return { openById, openNearest }
}
