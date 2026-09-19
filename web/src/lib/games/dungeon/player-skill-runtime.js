import { skillProfile } from './combat.js'
import { getPlayerSkillReadyAt, startPlayerSkillCooldown } from './player-entity.js'
import { presentDungeonPlayerSkill } from './player-skill-presentation.js'

function castPrimarySkill(scene, player) {
  const profile = skillProfile(player.state)
  presentDungeonPlayerSkill(scene, {
    x: player.state.x,
    y: player.state.y,
    radius: profile.radius,
  })

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

  return { hits, profile }
}

const SKILL_HANDLERS = {
  primary: castPrimarySkill,
}

export function playerSkillHandler(skillId = 'primary') {
  return SKILL_HANDLERS[skillId] ?? null
}

export function castPlayerSkill(scene, player, skillId = 'primary', time = scene?.time?.now ?? 0) {
  const handler = playerSkillHandler(skillId)
  if (!scene || !player || !handler) return { cast: false, hits: 0, skillId }
  if (time < getPlayerSkillReadyAt(player, skillId)) return { cast: false, hits: 0, skillId }

  const result = handler(scene, player)
  startPlayerSkillCooldown(player, skillId, time, result.profile.cooldown)
  scene.captureDungeonEvent?.({
    type: 'player.skill',
    playerId: String(player.id ?? ''),
    skillId,
    x: Number(player.state?.x) || 0,
    y: Number(player.state?.y) || 0,
    radius: Number(result.profile?.radius) || 0,
    hits: result.hits,
  })
  return { cast: true, hits: result.hits, skillId, profile: result.profile }
}
