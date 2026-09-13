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

function createImpactAudio(windowImpl = globalThis.window) {
  let context = null
  const ensure = () => { const AudioContext = windowImpl?.AudioContext || windowImpl?.webkitAudioContext; if (!AudioContext) return null; context ??= new AudioContext(); if (context.state === 'suspended') context.resume?.().catch?.(() => {}); return context }
  const play = (options = {}) => { const ctx = ensure(); if (!ctx) return; const profile = hitSoundProfile(options), now = ctx.currentTime, master = ctx.createGain(); master.gain.setValueAtTime(options.gain ?? profile.gain, now); master.gain.exponentialRampToValueAtTime(0.001, now + profile.duration); master.connect(ctx.destination); const high = ctx.createOscillator(); high.type = 'triangle'; high.frequency.setValueAtTime(profile.highFrequency, now); high.frequency.exponentialRampToValueAtTime(Math.max(70, profile.highFrequency * 0.55), now + profile.duration); high.connect(master); high.start(now); high.stop(now + profile.duration); const lowGain = ctx.createGain(); lowGain.gain.setValueAtTime(options.killed ? (options.elite ? 1 : 0.85) : options.critical ? 0.55 : 0.28, now); lowGain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration); lowGain.connect(master); const low = ctx.createOscillator(); low.type = 'sine'; low.frequency.setValueAtTime(profile.lowFrequency, now); low.frequency.exponentialRampToValueAtTime(Math.max(42, profile.lowFrequency * 0.62), now + profile.duration); low.connect(lowGain); low.start(now); low.stop(now + profile.duration) }
  return { play, close: () => context?.close?.().catch?.(() => {}) }
}

export function installDungeonAttackRuntime(scene, { random = Math.random } = {}) {
  if (!scene || scene.__dungeonAttackRuntimeInstalled) return scene?.__dungeonAttackRuntime ?? null
  scene.__dungeonAttackRuntimeInstalled = true
  installDungeonSfx(scene); installDungeonWorldVfx(scene); installDungeonWeaponVisuals(scene); installDungeonWeaponCombat(scene); installDungeonPlayerFacing(scene); installDungeonEnemyFeedback(scene); installDungeonEnemyBehaviors(scene)
  const originalSlash = scene.slash.bind(scene), originalDamageEnemy = scene.damageEnemy.bind(scene), originalApplyWeaponProcs = scene.applyWeaponProcs.bind(scene), audio = createImpactAudio()
  scene.slash = function spatialSlash(target) { if (!target || target.hp <= 0) return; const bladeTip = scene.__dungeonWeaponVisuals?.swing?.() ?? scene.playerState; scene.__dungeonVfx?.slash?.(bladeTip, target, false); originalSlash(target) }
  scene.damageEnemy = function spatialDamageEnemy(enemy, damage, critical, knockback, context = { direct: false, canProc: false, source: 'effect' }) {
    if (!enemy || enemy.hp <= 0) return
    const beforeHp = enemy.hp, impactX = enemy.x, impactY = enemy.y
    originalDamageEnemy(enemy, damage, critical, 0, context); if (enemy.hp >= beforeHp) return
    const killed = enemy.hp <= 0, elite = Boolean(enemy.elite || enemy.boss), feedback = hitFeedback({ critical, boss: enemy.boss, damage }), corpseBurst = context?.source === 'corpse_burst'
    scene.__dungeonVfx?.impact?.(impactX, impactY, { explosion: corpseBurst, seed: `${enemy.id ?? ''}:${beforeHp}:${damage}` }); if (critical || (elite && killed)) scene.__dungeonVfx?.critical?.(impactX, impactY, { seed: `${enemy.id ?? ''}:${beforeHp}` }); if (corpseBurst) scene.__dungeonVfx?.smoke?.(impactX, impactY, { seed: `${enemy.id ?? ''}:corpse` }); if (context?.direct || critical || killed) audio.play({ damage, critical, killed, elite })
    if (killed) scene.__dungeonEnemyFeedback?.death?.(enemy, { critical, damage, source: context?.source }); else scene.__dungeonEnemyFeedback?.hit?.(enemy, scene.playerState, { critical, damage, source: context?.source })
    if (enemy.visual?.setTintFill && enemy.visual?.clearTint) { enemy.visual.setTintFill(critical || elite ? 0xffe18a : 0xffffff); scene.time?.delayedCall?.(feedback.flashMs, () => { if (enemy.hp > 0 && enemy.visual?.active !== false) enemy.visual.clearTint() }) }
    if (context?.direct || critical || killed) { const killBonus = killed ? (elite ? 22 : 12) : 0; scene.__hitStopUntil = Math.max(scene.__hitStopUntil ?? 0, scene.time.now + feedback.hitStopMs + killBonus); scene.cameras?.main?.shake?.(feedback.flashMs, feedback.shake * (killed ? (elite ? 1.55 : 1.25) : 1)) }
    if (enemy.hp > 0 && knockback > 0) { const next = knockbackTarget({ ...enemy, hitRadius: enemy.hitRadius ?? (enemy.boss ? 26 : 15) }, scene.playerState, knockback * feedback.knockbackScale, scene.__roomGeometry); enemy.x = next.x; enemy.y = next.y; enemy.visual?.setPosition?.(enemy.x, enemy.y); scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp) }
  }
  scene.applyWeaponProcs = function spatialWeaponProcs(primary, damage, critical) {
    const effects = scene.playerState.effects ?? {}
    if (primary?.hp > 0 && effects.piercing > 0 && random() < effects.piercing) { const attack = piercingAttack(scene.playerState, scene.playerFacing, 390, 34, scene.__roomGeometry); scene.__dungeonVfx?.beam?.(attack); for (const target of targetsInBeam(attack, scene.enemies).filter((enemy) => enemy !== primary)) scene.damageEnemy(target, Math.max(1, Math.round(damage * 0.72)), false, 14, { direct: false, canProc: false, source: 'piercing' }) }
    if (effects.chain > 0 && random() < effects.chain) { const target = secondaryTarget(primary, scene.enemies, 165); if (target) { if (scene.__dungeonVfx?.lightning) scene.__dungeonVfx.lightning(primary, target, { primary: false }); else scene.effectLine(primary, target, 0x7bc5ff, 3); scene.damageEnemy(target, Math.max(1, Math.round(damage * 0.56)), false, 8, { direct: false, canProc: false, source: 'chain' }) } }
    if (critical && effects.thunder > 0 && random() < effects.thunder) { const segments = thunderChain(scene.playerState, primary, scene.enemies, 3, 190); segments.forEach((segment, index) => { scene.__dungeonVfx?.lightning?.(segment.from, segment.to, { primary: index === 0 }); if (index !== 0) scene.damageEnemy(segment.to, Math.max(1, Math.round(damage * 0.68)), false, 6, { direct: false, canProc: false, source: 'thunder' }) }) }
    if (effects.whirlwind > 0 && random() < effects.whirlwind) { const attack = whirlwindAttack(scene.playerState, 112); scene.__dungeonVfx?.whirlwind?.(attack); for (const enemy of targetsInCircle(attack, scene.enemies)) if (enemy !== primary) scene.damageEnemy(enemy, Math.max(1, Math.round(damage * 0.5)), false, 16, { direct: false, canProc: false, source: 'whirlwind' }) }
  }
  scene.events?.once?.('shutdown', () => { scene.slash = originalSlash; scene.damageEnemy = originalDamageEnemy; scene.applyWeaponProcs = originalApplyWeaponProcs; audio.close() })
  const api = { playImpactSound(options) { audio.play(options) }, restore() { scene.slash = originalSlash; scene.damageEnemy = originalDamageEnemy; scene.applyWeaponProcs = originalApplyWeaponProcs; scene.__dungeonEnemyBehaviors?.restore?.(); scene.__dungeonEnemyFeedback?.restore?.(); scene.__dungeonPlayerFacing?.restore?.(); scene.__dungeonWeaponCombat?.restore?.(); scene.__dungeonWeaponVisuals?.restore?.(); scene.__dungeonWorldVfx?.restore?.(); audio.close() } }
  scene.__dungeonAttackRuntime = api; return api
}
