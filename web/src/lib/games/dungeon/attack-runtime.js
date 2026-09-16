import { piercingAttack, targetsInBeam, targetsInCircle, thunderChain, whirlwindAttack } from './attacks.js'
import { hitFeedback, knockbackTarget } from './hit-feedback.js'
import { hitSoundProfile } from './combat-feel.js'
import { secondaryTarget } from './combat.js'
import { ensureDungeonCombatRuntime } from './combat-runtime.js'
import { currentEffects } from './player-loadout.js'
import { installDungeonSfx } from './sfx-runtime.js'
import { installDungeonWorldVfx } from './vfx-usage-runtime.js'
import { installDungeonWeaponVisuals } from './weapon-visual-runtime.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'
import { installDungeonPlayerFacing } from './player-facing-runtime.js'
import { installDungeonEnemyFeedback } from './enemy-feedback-runtime.js'
import { installDungeonEnemyBehaviors } from './enemy-behavior-runtime.js'
import { weaponGroupSkill } from './weapon-skill.js'
import { weaponProfile } from './weapon-profile.js'

function createImpactAudio(windowImpl = globalThis.window) {
  let context = null

  const ensure = () => {
    const AudioContext = windowImpl?.AudioContext || windowImpl?.webkitAudioContext
    if (!AudioContext) return null

    context ??= new AudioContext()
    if (context.state === 'suspended') context.resume?.().catch?.(() => {})
    return context
  }

  const play = (options = {}) => {
    const ctx = ensure()
    if (!ctx) return

    const profile = hitSoundProfile(options)
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(options.gain ?? profile.gain, now)
    master.gain.exponentialRampToValueAtTime(0.001, now + profile.duration)
    master.connect(ctx.destination)

    const high = ctx.createOscillator()
    high.type = 'triangle'
    high.frequency.setValueAtTime(profile.highFrequency, now)
    high.frequency.exponentialRampToValueAtTime(
      Math.max(70, profile.highFrequency * 0.55),
      now + profile.duration,
    )
    high.connect(master)
    high.start(now)
    high.stop(now + profile.duration)

    const lowGain = ctx.createGain()
    lowGain.gain.setValueAtTime(
      options.killed ? (options.elite ? 1 : 0.85) : options.critical ? 0.55 : 0.28,
      now,
    )
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration)
    lowGain.connect(ctx.destination)

    const low = ctx.createOscillator()
    low.type = 'sine'
    low.frequency.setValueAtTime(profile.lowFrequency, now)
    low.frequency.exponentialRampToValueAtTime(
      Math.max(42, profile.lowFrequency * 0.62),
      now + profile.duration,
    )
    low.connect(lowGain)
    low.start(now)
    low.stop(now + profile.duration)
  }

  return {
    play,
    close: () => context?.close?.().catch?.(() => {}),
  }
}

export function installDungeonAttackRuntime(scene, { random = Math.random, player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonAttackRuntimeInstalled) {
    return scene?.__dungeonAttackRuntime ?? null
  }

  scene.__dungeonAttackRuntimeInstalled = true
  const combat = ensureDungeonCombatRuntime(scene)

  installDungeonSfx(scene, { player })
  installDungeonWorldVfx(scene, { player })
  installDungeonWeaponVisuals(scene, { player })
  installDungeonWeaponCombat(scene)
  installDungeonPlayerFacing(scene, { player })
  installDungeonEnemyFeedback(scene)
  installDungeonEnemyBehaviors(scene, { player })

  const originalSlash = scene.slash
  const originalAutoAttack = scene.autoAttack
  const originalDamageEnemy = scene.damageEnemy
  const originalApplyWeaponProcs = scene.applyWeaponProcs
  const audio = createImpactAudio()

  scene.slash = function spatialSlash(target, attacker = player) {
    if (!target || target.hp <= 0 || !attacker) return

    const previousDamage = attacker.state.damage
    attacker.state.damage = combat.weaponDamageStat(attacker, previousDamage)
    combat.beginWeaponAttack(target, attacker)
    try {
      const weaponVisuals = attacker.runtime?.weaponVisuals
        ?? (attacker === scene.localPlayer ? scene.__dungeonWeaponVisuals : null)
      const attackOrigin = weaponVisuals?.swing?.() ?? attacker.state
      if (weaponProfile(attacker.state).attackMode !== 'ranged') {
        scene.__dungeonVfx?.slash?.(attackOrigin, target, false)
      }
      return originalSlash.call(scene, target, attacker)
    } finally {
      attacker.state.damage = previousDamage
    }
  }

  const damageResolver = (hit, coreDamage) => {
    const {
      enemy,
      damage,
      critical,
      knockback,
      context = { direct: false, canProc: false, source: 'effect' },
      player: attacker = player,
    } = hit
    if (!enemy || enemy.hp <= 0 || !attacker) return null

    const beforeHp = enemy.hp
    const impactX = enemy.x
    const impactY = enemy.y

    const value = coreDamage({ ...hit, knockback: 0 })
    if (enemy.hp >= beforeHp) return value

    const killed = enemy.hp <= 0
    const elite = Boolean(enemy.elite || enemy.boss)
    const feedback = hitFeedback({ critical, boss: enemy.boss, damage })
    const corpseBurst = context?.source === 'corpse_burst'

    scene.__dungeonVfx?.impact?.(impactX, impactY, {
      explosion: corpseBurst,
      seed: `${enemy.id ?? ''}:${beforeHp}:${damage}`,
    })

    if (critical || (elite && killed)) {
      scene.__dungeonVfx?.critical?.(impactX, impactY, {
        seed: `${enemy.id ?? ''}:${beforeHp}`,
      })
    }

    if (corpseBurst) {
      scene.__dungeonVfx?.smoke?.(impactX, impactY, {
        seed: `${enemy.id ?? ''}:corpse`,
      })
    }

    if (context?.direct || critical || killed) {
      audio.play({ damage, critical, killed, elite })
    }

    if (killed) {
      scene.__dungeonEnemyFeedback?.death?.(enemy, {
        critical,
        damage,
        source: context?.source,
      })
    } else {
      scene.__dungeonEnemyFeedback?.hit?.(enemy, attacker.state, {
        critical,
        damage,
        source: context?.source,
      })
    }

    if (enemy.visual?.setTintFill && enemy.visual?.clearTint) {
      enemy.visual.setTintFill(critical || elite ? 0xffe18a : 0xffffff)
      scene.time?.delayedCall?.(feedback.flashMs, () => {
        if (enemy.hp > 0 && enemy.visual?.active !== false) {
          enemy.visual.clearTint()
        }
      })
    }

    if (context?.direct || critical || killed) {
      const killBonus = killed ? (elite ? 22 : 12) : 0
      scene.__hitStopUntil = Math.max(
        scene.__hitStopUntil ?? 0,
        scene.time.now + feedback.hitStopMs + killBonus,
      )
      scene.cameras?.main?.shake?.(
        feedback.flashMs,
        feedback.shake * (killed ? (elite ? 1.55 : 1.25) : 1),
      )
    }

    if (enemy.hp > 0 && knockback > 0) {
      const next = knockbackTarget(
        { ...enemy, hitRadius: enemy.hitRadius ?? (enemy.boss ? 26 : 15) },
        attacker.state,
        knockback * feedback.knockbackScale,
        scene.__roomGeometry,
      )
      enemy.x = next.x
      enemy.y = next.y
      enemy.visual?.setPosition?.(enemy.x, enemy.y)
      scene.updateHealthBar?.(
        enemy.healthBar,
        enemy.x,
        enemy.y - enemy.barOffset,
        enemy.hp,
        enemy.maxHp,
      )
    }
    return value
  }

  const procOwner = (primary, damage, critical, attacker = player) => {
    if (!attacker) return null
    const effects = currentEffects(attacker.state)
    const groupSkill = weaponGroupSkill(attacker.state)

    if (primary?.hp > 0 && effects.piercing > 0 && random() < effects.piercing) {
      const attack = piercingAttack(
        attacker.state,
        attacker.facing,
        390,
        34,
        scene.__roomGeometry,
      )
      scene.__dungeonVfx?.beam?.(attack)

      for (const target of targetsInBeam(attack, scene.enemies).filter((enemy) => enemy !== primary)) {
        combat.damageEnemy(
          target,
          Math.max(1, Math.round(damage * 0.72)),
          false,
          14,
          { direct: false, canProc: false, source: 'piercing' },
          attacker,
        )
      }
    }

    if (effects.chain > 0 && random() < effects.chain) {
      const target = secondaryTarget(primary, scene.enemies, 165)
      if (target) {
        scene.__dungeonVfx?.lightning?.(primary, target, { primary: false })
        combat.damageEnemy(
          target,
          Math.max(1, Math.round(damage * 0.56)),
          false,
          8,
          { direct: false, canProc: false, source: 'chain' },
          attacker,
        )
      }
    }

    if (effects.thunder > 0 && random() < effects.thunder) {
      const segments = thunderChain(attacker.state, primary, scene.enemies, 3, 190)
      segments.forEach((segment, index) => {
        scene.__dungeonVfx?.lightning?.(segment.from, segment.to, { primary: index === 0 })
        combat.damageEnemy(
          segment.to,
          Math.max(1, Math.round(damage * 0.68)),
          false,
          6,
          { direct: false, canProc: false, source: 'thunder' },
          attacker,
        )
      })
    }

    if (groupSkill === 'whirlwind' && effects.whirlwind > 0 && random() < effects.whirlwind) {
      const attack = whirlwindAttack(attacker.state, 112)
      scene.__dungeonVfx?.whirlwind?.(attack)

      for (const enemy of targetsInCircle(attack, scene.enemies)) {
        if (enemy === primary) continue
        combat.damageEnemy(
          enemy,
          Math.max(1, Math.round(damage * 0.5)),
          false,
          16,
          { direct: false, canProc: false, source: 'whirlwind' },
          attacker,
        )
      }
    }
    return null
  }

  const restoreDamageResolver = combat.setDamageResolver(damageResolver)
  const restoreProcOwner = combat.setProcOwner(procOwner)

  const autoAttackDelegate = (time, attacker = player) => combat.attack(attacker, time)
  const damageDelegate = (...args) => combat.damageEnemy(...args)
  const procDelegate = (...args) => combat.applyWeaponProcs(...args)
  scene.autoAttack = autoAttackDelegate
  scene.damageEnemy = damageDelegate
  scene.applyWeaponProcs = procDelegate

  let restored = false
  const restore = () => {
    if (restored) return
    restored = true
    if (scene.slash !== originalSlash) scene.slash = originalSlash
    if (scene.autoAttack === autoAttackDelegate) scene.autoAttack = originalAutoAttack
    if (scene.damageEnemy === damageDelegate) scene.damageEnemy = originalDamageEnemy
    if (scene.applyWeaponProcs === procDelegate) scene.applyWeaponProcs = originalApplyWeaponProcs
    restoreProcOwner()
    restoreDamageResolver()
    scene.__dungeonEnemyBehaviors?.restore?.()
    scene.__dungeonEnemyFeedback?.restore?.()
    scene.__dungeonPlayerFacing?.restore?.()
    scene.__dungeonWeaponCombat?.restore?.()
    scene.__dungeonWeaponVisuals?.restore?.()
    scene.__dungeonWorldVfx?.restore?.()
    audio.close()
    scene.__dungeonAttackRuntimeInstalled = false
    if (scene.__dungeonAttackRuntime === api) scene.__dungeonAttackRuntime = null
  }

  const api = {
    playImpactSound(options) {
      audio.play(options)
    },
    restore,
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  scene.__dungeonAttackRuntime = api
  return api
}
