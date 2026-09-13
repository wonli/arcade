import { bossReward } from './combat.js'
import { bossEncounterProfile, encounterVariantForFloor } from './encounter-profile.js'
import { createPerformanceBudget } from './performance-budget.js'

export function installDungeonGameplayPass(scene, { random = Math.random } = {}) {
  if (!scene || scene.__dungeonGameplayPass) return scene?.__dungeonGameplayPass ?? null

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
    scene.fireEnemyProjectile = function boundedEnemyProjectile(enemy) {
      if ((scene.enemyProjectiles?.length ?? 0) >= 20) return
      return originalProjectile(enemy)
    }
  }

  if (originalBoss) {
    scene.updateBoss = function updateGameplayBoss(enemy, time, dt) {
      if (enemy?.encounter?.id !== 'stormcaller') return originalBoss(enemy, time, dt)

      if (enemy.hp / enemy.maxHp <= enemy.phaseThreshold && enemy.phase === 1) {
        enemy.phase = 2
        enemy.visual?.setTint?.(enemy.encounter.accent)
      }

      scene.moveEnemyTowardPlayer?.(enemy, time, dt)
      if (time < (enemy.nextVariantAttackAt ?? 0)) return

      enemy.nextVariantAttackAt = time + (enemy.phase === 2 ? 1050 : 1450)
      const burst = enemy.phase === 2 ? 5 : 3
      for (let i = 0; i < burst; i++) {
        scene.time?.delayedCall?.(i * 95, () => {
          if (enemy.hp <= 0 || scene.dead) return
          if ((scene.enemyProjectiles?.length ?? 0) >= 20) return
          originalProjectile?.(enemy)
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
          (scene.playerState?.x ?? 480) + 42,
          scene.playerState?.y ?? 300,
          bossReward(random, scene.floor ?? 1),
        )
        scene.showBanner?.('TREASURE ROOM', '#ffd56a', 30)
        scene.time?.delayedCall?.(350, () => scene.openPortal?.())
      } else if (role === 'antechamber') {
        const maxHp = scene.playerState?.maxHp ?? 0
        const heal = Math.round(maxHp * 0.12)
        if (heal > 0) {
          scene.playerState.hp = Math.min(maxHp, (scene.playerState.hp ?? 0) + heal)
          scene.updateHealthBar?.(
            scene.playerBar,
            scene.playerState.x,
            scene.playerState.y - 42,
            scene.playerState.hp,
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
