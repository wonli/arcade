import { createPlayerEntity } from '../player-entity.js'

export function attachLegacyTestPlayer(scene) {
  if (scene.localPlayer) return scene

  const state = scene.playerState ?? {}
  const player = createPlayerEntity({
    id: 'test',
    state,
    actor: scene.player ?? null,
    bar: scene.playerBar ?? null,
    facing: scene.playerFacing ?? 'down',
  })

  // Tests often retain the original fixture object and assert mutations on it.
  // Preserve that reference here; production PlayerEntity still defensively clones inputs.
  player.state = state
  player.moving = scene.playerMoving ?? false
  player.attacking = scene.playerAttacking ?? false
  player.lastAttackAt = scene.lastAttackAt ?? 0
  player.skillReadyAt = scene.skillReadyAt ?? 0
  player.lastContactAt = scene.lastContactAt ?? 0
  player.dead = scene.dead ?? false
  scene.localPlayer = player
  return scene
}
