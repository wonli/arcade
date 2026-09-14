import { piercingAttack, targetsInBeam, targetsInCircle, thunderChain, whirlwindAttack } from './attacks.js'
import { hitFeedback, knockbackTarget } from './hit-feedback.js'
import { hitSoundProfile } from './combat-feel.js'
import { secondaryTarget } from './combat.js'
import { installDungeonSfx } from './sfx-runtime.js'
import { installDungeonWorldVfx } from './vfx-usage-runtime.js'
import { installDungeonWeaponVisuals } from './weapon-visual-runtime.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'
import { installDungeonPlayerFacing } from './player-facing-runtime.js'
import { installDungeonEnemyFeedback } from './enemy-feedback-runtime.js'
import { installDungeonEnemyBehaviors } from './enemy-behavior-runtime.js'
import { installDungeonPlayerRuntime } from './player-runtime.js'
import { weaponGroupSkill } from './weapon-skill.js'

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
    lowGain.connect(master)

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

function playerContext(scene, player = null) {
  return player ?? scene.localPlayer ?? scene.__dungeonPlayerRuntime?.localPlayer ?? {
    local: true,
    state: scene.playerState,
    facing: scene.playerFacing,
  }
}

export function installDungeonAttackRuntime(scene, { random = Math.random } = {}) {
  if (!scene || scene.__dungeonAttackRuntimeInstalled) {
    return scene?.__dungeonAttackRuntime ?? null
  }

  scene.__dungeonAttackRuntimeInstalled = true
  installDungeonPlayerRuntime(scene)
  installDungeonSfx(scene)
  installDungeonWorldVfx(scene)
  installDungeonWeaponVisuals(scene)
  installDungeonWeaponCombat(scene)
  installDungeonPlayerFacing(scene)
  installDungeonEnemyFeedback(scene)
  installDungeonEnemyBehaviors(scene)

  const originalSlash = scene.slash.bind(scene)
  const originalDamageEnemy = scene.damageEnemy.bind(scene)
  const originalApplyWeaponProcs = scene.applyWeaponProcs.bind(scene)
  const audio = createImpactAudio()

  scene.slash = function spatialSlash(target, player = null) {
    if (!target || target.hp <= 0) return
    const context = playerContext(scene, player)
    const bladeTip = context.local !== false
      ? (scene.__dungeonWeaponVisuals?.swing?.() ?? context.state)
      : context.state
    scene.__dungeonVfx?.slash?.(bladeTip, target, false)
    return originalSlash(target, context)
  }

  scene.damageEnemy = function spatialDamageEnemy(
    enemy,
    damage,
    critical,
    knockback,
    damageContext = { direct: false, canProc: false, source: 'effect' },
    player = null,
  ) {
    if (!enemy || enemy.hp <= 0) return

    const context = playerContext(scene, player)
    const sourceState = context.state ?? scene.playerState
    const beforeHp = enemy.hp
    const impactX = enemy.x
    const impactY = enemy.y

    originalDamageEnemy(enemy, damage, critical, 0, damageContext, context)
    if (enemy.hp >= beforeHp) return

    const killed = enemy.hp <= 0
    const elite = Boolean(enemy.elite || enemy.boss)
    const feedback = hitFeedback({ critical, boss: enemy.boss, damage })
    const corpseBurst = damageContext?.source === 'corpse_burst'

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

    if (damageContext?.direct || critical || killed) {
      audio.play({ damage, critical, killed, elite })
    }

    if (killed) {
      scene.__dungeonEnemyFeedback?.death?.(enemy, {
        critical,
        damage,
        source: damageContext?.source,
      })
    } else {
      scene.__dungeonEnemyFeedback?.hit?.(enemy, sourceState, {
        critical,
        damage,
        source: damageContext?.source,
      })
    }

    if (enemy.visual?.setTintFill && enemy.visual?.clearTint) {
      enemy.visual.setTintFill(critical || elite ? 0xffe18a : 0xffffff)
      scene.time?.delayedCall?.(feedback.flashMs, () => {
        if (enemy.hp > 0 && enemy.visual?.active !== false) enemy.visual.clearTint()
      })
    }

    if (damageContext?.direct || critical || killed) {
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
        sourceState,
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
  }

  scene.applyWeaponProcs = function spatialWeaponProcs(primary, damage, critical, player = null) {
    const context = playerContext(scene, player)
    const state = context.state ?? scene.playerState
    const effects = state.effects ?? {}
    const groupSkill = weaponGroupSkill(state)

    if (primary?.hp > 0 && effects.piercing > 0 && random() < effects.piercing) {
      const attack = piercingAttack(
        state,
        context.facing ?? scene.playerFacing,
        390,
        34,
        scene.__roomGeometry,
      )
      scene.__dungeonVfx?.beam?.(attack)

      for (const target of targetsInBeam(attack, scene.enemies).filter((enemy) => enemy !== primary)) {
        scene.damageEnemy(
          target,
          Math.max(1, Math.round(damage * 0.72)),
          false,
          14,
          { direct: false, canProc: false, source: 'piercing' },
          context,
        )
      }
    }

    if (effects.chain > 0 && random() < effects.chain) {
      const target = secondaryTarget(primary, scene.enemies, 165)
      if (target) {
        scene.__dungeonVfx?.lightning?.(primary, target, { primary: false })
        scene.damageEnemy(
          target,
          Math.max(1, Math.round(damage * 0.56)),
          false,
          8,
          { direct: false, canProc: false, source: 'chain' },
          context,
        )
      }
    }

    if (effects.thunder > 0 && random() < effects.thunder) {
      const segments = thunderChain(state, primary, scene.enemies, 3, 190)
      segments.forEach((segment, index) => {
        scene.__dungeonVfx?.lightning?.(segment.from, segment.to, { primary: index === 0 })
        scene.damageEnemy(
          segment.to,
          Math.max(1, Math.round(damage * 0.68)),
          false,
          6,
          { direct: false, canProc: false, source: 'thunder' },
          context,
        )
      })
    }

    if (groupSkill === 'whirlwind' && effects.whirlwind > 0 && random() < effects.whirlwind) {
      const attack = whirlwindAttack(state, 112)
      scene.__dungeonVfx?.whirlwind?.(attack)

      for (const enemy of targetsInCircle(attack, scene.enemies)) {
        if (enemy === primary) continue
        scene.damageEnemy(
          enemy,
          Math.max(1, Math.round(damage * 0.5)),
          false,
          16,
          { direct: false, canProc: false, source: 'whirlwind' },
          context,
        )
      }
    }
  }

  scene.events?.once?.('shutdown', () => {
    scene.slash = originalSlash
    scene.damageEnemy = originalDamageEnemy
    scene.applyWeaponProcs = originalApplyWeaponProcs
    audio.close()
  })

  const api = {
    playImpactSound(options) { audio.play(options) },
    restore() {
      scene.slash = originalSlash
      scene.damageEnemy = originalDamageEnemy
      scene.applyWeaponProcs = originalApplyWeaponProcs
      scene.__dungeonEnemyBehaviors?.restore?.()
      scene.__dungeonEnemyFeedback?.restore?.()
      scene.__dungeonPlayerFacing?.restore?.()
      scene.__dungeonWeaponCombat?.restore?.()
      scene.__dungeonWeaponVisuals?.restore?.()
      scene.__dungeonWorldVfx?.restore?.()
      audio.close()
    },
  }

  scene.__dungeonAttackRuntime = api
  return api
}
