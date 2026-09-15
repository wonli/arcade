import { createPlayerEntity } from '../player-entity.js'

export function attachLegacyTestPlayer(scene) {
  if (scene.localPlayer) return scene

  const player = createPlayerEntity({
    id: 'test',
    state: scene.playerState ?? {},
    actor: scene.player ?? null,
    bar: scene.playerBar ?? null,
    facing: scene.playerFacing ?? 'down',
  })

  player.moving = scene.playerMoving ?? false
  player.attacking = scene.playerAttacking ?? false
  player.lastAttackAt = scene.lastAttackAt ?? 0
  player.skillReadyAt = scene.skillReadyAt ?? 0
  player.lastContactAt = scene.lastContactAt ?? 0
  player.dead = scene.dead ?? false
  scene.localPlayer = player
  return scene
}
