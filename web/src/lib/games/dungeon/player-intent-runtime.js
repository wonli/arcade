import { getPlayerSkillReadyAt } from './player-entity.js'

export function createPlayerIntentRuntime({ player, emit = () => {} } = {}) {
  if (!player) throw new TypeError('Player is required')

  let lastAttackAt = Number(player.lastAttackAt) || 0
  let primaryReadyAt = getPlayerSkillReadyAt(player, 'primary')

  function observe() {
    const nextAttackAt = Number(player.lastAttackAt) || 0
    const nextPrimaryReadyAt = getPlayerSkillReadyAt(player, 'primary')

    if (nextAttackAt > lastAttackAt) {
      emit({ type: 'attack', playerId: String(player.id) })
    }
    if (nextPrimaryReadyAt > primaryReadyAt) {
      emit({ type: 'skill', playerId: String(player.id), skillId: 'primary' })
    }

    lastAttackAt = nextAttackAt
    primaryReadyAt = nextPrimaryReadyAt
  }

  return { observe }
}

export function installPlayerIntentRuntime(scene, { player = scene?.localPlayer, onIntent = () => {} } = {}) {
  if (!scene?.events?.on || !scene?.events?.off) throw new TypeError('Scene events are required')
  const runtime = createPlayerIntentRuntime({ player, emit: onIntent })
  const observe = () => runtime.observe()

  scene.events.on('postupdate', observe)

  return {
    observe: runtime.observe,
    restore() {
      scene.events.off('postupdate', observe)
    },
  }
}
