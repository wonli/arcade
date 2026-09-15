import { skillProfile } from './combat.js'
import { getPlayerSkillReadyAt, startPlayerSkillCooldown } from './player-entity.js'

export function castPlayerSkill(scene, player, skillId = 'primary', time = scene?.time?.now ?? 0) {
  if (!scene || !player || skillId !== 'primary') return { cast: false, hits: 0, skillId }
  if (time < getPlayerSkillReadyAt(player, skillId)) return { cast: false, hits: 0, skillId }

  const profile = skillProfile(player.state)
  startPlayerSkillCooldown(player, skillId, time, profile.cooldown)

  const ring = scene.add?.circle?.(player.state.x, player.state.y, 20, 0xc1ff56, 0.1)
  ring?.setStrokeStyle?.(4, 0xc1ff56, 0.9)
  if (ring) {
    scene.tweens?.add?.({
      targets: ring,
      radius: profile.radius,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy?.(),
    })
  }

  let hits = 0
  for (const enemy of scene.enemies ?? []) {
    if (!enemy || enemy.hp <= 0) continue
    if (Math.hypot(enemy.x - player.state.x, enemy.y - player.state.y) > profile.radius) continue
    scene.damageEnemy?.(
      enemy,
      Math.round((player.state.damage ?? 0) * 1.6),
      true,
      28,
      { direct: false, canProc: false, source: 'skill' },
      player,
    )
    hits++
  }

  scene.cameras?.main?.shake?.(100, 0.006)
  return { cast: true, hits, skillId, profile }
}
