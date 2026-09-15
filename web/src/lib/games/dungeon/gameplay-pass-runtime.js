import { bossReward } from './combat.js'
import { bossEncounterProfile, encounterVariantForFloor } from './encounter-profile.js'
import { createPerformanceBudget } from './performance-budget.js'

export function installDungeonGameplayPass(scene, { player = scene?.localPlayer, random = Math.random } = {}) {
  if (!scene || !player || scene.__dungeonGameplayPass) return scene?.__dungeonGameplayPass ?? null

  const originalSpawn = scene.spawnEnemy?.bind(scene)
  const originalBoss = scene.updateBoss?.bind(scene)
  const originalProjectile = scene.fireEnemyProjectile?.bind(scene)
  const originalStart = scene.startFloor?.bind(scene)
  const budget = createPerformanceBudget({ cosmetics: 24, projectiles: 20 })

  if (originalSpawn) {
    scene.spawnEnemy = function spawnGameplayEnemy(...args) {
      const enemy = originalSpawn(...args)
      if (!enemy) return enemy

      if (enemy.boss) {
        const chapter = scene.__infiniteDungeon?.getProgress?.().chapter ?? 0
        enemy.encounter = bossEncounterProfile((scene.floor ?? 1) + chapter)
        if (enemy.encounter.id === 'stormcaller') {
          enemy.tint = enemy.encounter.accent
          enemy.visual?.setTint?.(enemy.tint)
        }
        return enemy
      }

      enemy.encounter = encounterVariantForFloor(enemy.archetype, scene.floor ?? 1, random())
      if (enemy.encounter.id === 'charger') {
        enemy.nextSpecialAt = Math.min(enemy.nextSpecialAt ?? Infinity, (scene.time?.now ?? 0) + 420)
      }
      if (enemy.encounter.id === 'bombardier') {
        enemy.projectileCooldown = Math.max(720, Math.round((enemy.projectileCooldown || 1400) * 0.82))
      }
      return enemy
    }
  }

  if (originalProjectile) {
    scene.fireEnemyProjectile = function boundedEnemyProjectile(enemy, target = player) {
      if ((scene.enemyProjectiles?.length ?? 0) >= 20) return
      return originalProjectile(enemy, target)
    }
  }

  if (originalBoss) {
    scene.updateBoss = function updateGameplayBoss(enemy, time, dt, target = player) {
      if (enemy?.encounter?.id !== 'stormcaller') return originalBoss(enemy, time, dt, target)

      if (enemy.hp / enemy.maxHp <= enemy.phaseThreshold && enemy.phase === 1) {
        enemy.phase = 2
        enemy.visual?.setTint?.(enemy.encounter.accent)
      }

      scene.moveEnemyTowardPlayer?.(enemy, time, dt, target)
      if (time < (enemy.nextVariantAttackAt ?? 0)) return

      enemy.nextVariantAttackAt = time + (enemy.phase === 2 ? 1050 : 1450)
      const burst = enemy.phase === 2 ? 5 : 3
      for (let i = 0; i < burst; i++) {
        scene.time?.delayedCall?.(i * 95, () => {
          if (enemy.hp <= 0 || target.dead) return
          if ((scene.enemyProjectiles?.length ?? 0) >= 20) return
          originalProjectile?.(enemy, target)
        })
      }
    }
  }

  if (originalStart) {
    scene.startFloor = function startGameplayFloor(...args) {
      const result = originalStart(...args)
      const progress = scene.__infiniteDungeon?.getProgress?.()
      const role = progress?.roomRole

      if (role === 'treasure') {
        scene.clearEnemies?.()
        scene.clearEnemyProjectiles?.()
        scene.floorCleared = true
        scene.spawnDrop?.(
          (player.state?.x ?? 480) + 42,
          player.state?.y ?? 300,
          bossReward(random, scene.floor ?? 1),
        )
        scene.showBanner?.('TREASURE ROOM', '#ffd56a', 30)
        scene.time?.delayedCall?.(350, () => scene.openPortal?.())
      } else if (role === 'antechamber') {
        const maxHp = player.state?.maxHp ?? 0
        const heal = Math.round(maxHp * 0.12)
        if (heal > 0) {
          player.state.hp = Math.min(maxHp, (player.state.hp ?? 0) + heal)
          scene.updateHealthBar?.(
            player.bar,
            player.state.x,
            player.state.y - 42,
            player.state.hp,
            maxHp,
          )
          scene.emitStats?.()
        }
        scene.showBanner?.('BOSS ANTECHAMBER', '#ffb55c', 28)
      }

      return result
    }
  }

  const restore = () => {
    if (originalSpawn) scene.spawnEnemy = originalSpawn
    if (originalBoss) scene.updateBoss = originalBoss
    if (originalProjectile) scene.fireEnemyProjectile = originalProjectile
    if (originalStart) scene.startFloor = originalStart
    scene.__dungeonGameplayPass = null
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { budget, restore }
  scene.__dungeonGameplayPass = api
  return api
}
