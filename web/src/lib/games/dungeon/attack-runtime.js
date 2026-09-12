import { piercingAttack, targetsInBeam, targetsInCircle, thunderChain, whirlwindAttack } from './attacks.js'
import { hitFeedback, knockbackTarget } from './hit-feedback.js'
import { secondaryTarget } from './combat.js'

export function installDungeonAttackRuntime(scene, { random = Math.random } = {}) {
  if (!scene || scene.__dungeonAttackRuntimeInstalled) return scene?.__dungeonAttackRuntime ?? null
  scene.__dungeonAttackRuntimeInstalled = true

  const originalSlash = scene.slash.bind(scene)
  const originalDamageEnemy = scene.damageEnemy.bind(scene)
  const originalApplyWeaponProcs = scene.applyWeaponProcs.bind(scene)

  scene.slash = function spatialSlash(target) {
    if (!target || target.hp <= 0) return
    scene.__dungeonVfx?.slash?.(scene.playerState, target, false)
    originalSlash(target)
  }

  scene.damageEnemy = function spatialDamageEnemy(enemy, damage, critical, knockback, context = { direct: false, canProc: false, source: 'effect' }) {
    if (!enemy || enemy.hp <= 0) return
    const beforeHp = enemy.hp
    const impactX = enemy.x
    const impactY = enemy.y
    originalDamageEnemy(enemy, damage, critical, 0, context)
    if (enemy.hp >= beforeHp) return

    const feedback = hitFeedback({ critical, boss: enemy.boss, damage })
    scene.__dungeonVfx?.impact?.(impactX, impactY, { critical, explosion: context?.source === 'corpse_burst' })

    const meaningfulStop = context?.direct || critical
    if (meaningfulStop) {
      scene.__hitStopUntil = Math.max(scene.__hitStopUntil ?? 0, scene.time.now + feedback.hitStopMs)
      scene.cameras?.main?.shake?.(feedback.flashMs, feedback.shake)
    }

    if (enemy.hp > 0 && knockback > 0) {
      const next = knockbackTarget(
        { ...enemy, hitRadius: enemy.hitRadius ?? (enemy.boss ? 26 : 15) },
        scene.playerState,
        knockback * feedback.knockbackScale,
        scene.__roomGeometry,
      )
      enemy.x = next.x
      enemy.y = next.y
      enemy.visual?.setPosition?.(enemy.x, enemy.y)
      scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
    }
  }

  scene.applyWeaponProcs = function spatialWeaponProcs(primary, damage, critical) {
    const effects = scene.playerState.effects ?? {}

    if (primary?.hp > 0 && effects.piercing > 0 && random() < effects.piercing) {
      const attack = piercingAttack(scene.playerState, scene.playerFacing, 390, 34, scene.__roomGeometry)
      scene.__dungeonVfx?.beam?.(attack)
      const targets = targetsInBeam(attack, scene.enemies).filter((enemy) => enemy !== primary)
      for (const target of targets) {
        scene.damageEnemy(target, Math.max(1, Math.round(damage * 0.72)), false, 14, {
          direct: false,
          canProc: false,
          source: 'piercing',
        })
      }
    }

    if (effects.chain > 0 && random() < effects.chain) {
      const target = secondaryTarget(primary, scene.enemies, 165)
      if (target) {
        scene.effectLine(primary, target, 0x7bc5ff, 3)
        scene.damageEnemy(target, Math.max(1, Math.round(damage * 0.56)), false, 8, {
          direct: false,
          canProc: false,
          source: 'chain',
        })
      }
    }

    if (critical && effects.thunder > 0 && random() < effects.thunder) {
      const segments = thunderChain(scene.playerState, primary, scene.enemies, 3, 190)
      segments.forEach((segment, index) => {
        scene.__dungeonVfx?.lightning?.(segment.from, segment.to, { primary: index === 0 })
        if (index === 0) return
        scene.damageEnemy(segment.to, Math.max(1, Math.round(damage * 0.68)), false, 6, {
          direct: false,
          canProc: false,
          source: 'thunder',
        })
      })
    }

    if (effects.whirlwind > 0 && random() < effects.whirlwind) {
      const attack = whirlwindAttack(scene.playerState, 112)
      scene.__dungeonVfx?.whirlwind?.(attack)
      for (const enemy of targetsInCircle(attack, scene.enemies)) {
        if (enemy === primary) continue
        scene.damageEnemy(enemy, Math.max(1, Math.round(damage * 0.5)), false, 16, {
          direct: false,
          canProc: false,
          source: 'whirlwind',
        })
      }
    }
  }

  scene.events?.once?.('shutdown', () => {
    scene.slash = originalSlash
    scene.damageEnemy = originalDamageEnemy
    scene.applyWeaponProcs = originalApplyWeaponProcs
  })

  const api = {
    restore() {
      scene.slash = originalSlash
      scene.damageEnemy = originalDamageEnemy
      scene.applyWeaponProcs = originalApplyWeaponProcs
    },
  }
  scene.__dungeonAttackRuntime = api
  return api
}
