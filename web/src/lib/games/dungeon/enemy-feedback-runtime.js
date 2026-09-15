import { installDungeonEnemyBehaviors } from './enemy-behavior-runtime.js'

export function enemyHitProfile({ critical = false, elite = false, boss = false, damage = 0 } = {}) {
  const weight = Math.max(0, Math.min(1, Number(damage || 0) / 80))
  const base = 5 + weight * 3 + (critical ? 3 : 0) + (elite ? 1 : 0)
  return { recoilPx: Number((boss ? base * 0.32 : base).toFixed(2)), durationMs: boss ? 82 : critical ? 125 : 96, squashX: critical ? 1.1 : 1.06, squashY: critical ? 0.88 : 0.92 }
}

export function enemyDeathProfile({ elite = false, boss = false } = {}) {
  if (boss) return { durationMs: 290, endScale: 0.68, liftPx: 10, rotation: 7 }
  if (elite) return { durationMs: 250, endScale: 0.62, liftPx: 8, rotation: 10 }
  return { durationMs: 205, endScale: 0.55, liftPx: 6, rotation: 12 }
}

export function bossTelegraphProfile(kind, { phase = 1 } = {}) {
  const phaseTwo = phase >= 2
  if (kind === 'charge') return { windupMs: 420, shapeCount: 2, width: phaseTwo ? 28 : 24, alpha: phaseTwo ? 0.34 : 0.27 }
  return { windupMs: 560, shapeCount: 3, radius: 130, alpha: phaseTwo ? 0.26 : 0.2 }
}

export function bossActionProfile(kind, { phase = 1 } = {}) {
  if (kind === 'charge') return { windupMs: 420, gatherScaleX: 0.9, gatherScaleY: 1.08, recoilPx: phase >= 2 ? 8 : 6, releaseScaleX: phase >= 2 ? 1.2 : 1.14, releaseScaleY: 0.92, releaseMs: 110 }
  if (kind === 'shockwave') return { windupMs: 560, gatherScale: phase >= 2 ? 1.14 : 1.1, stompScaleX: 1.14, stompScaleY: 0.78, stompMs: 120 }
  return { durationMs: 300, burstScale: 1.22, settleScale: 1, radius: 62 }
}

export function bossPlayerHitProfile({ damage = 0 } = {}) {
  const weight = Math.max(0, Math.min(1, Number(damage || 0) / 40))
  return { shake: Number((0.006 + weight * 0.006).toFixed(4)), shakeMs: Math.round(90 + weight * 50), flashMs: Math.round(85 + weight * 55) }
}

function baseScale(enemy) { return { x: Math.abs(enemy?.visual?.scaleX ?? enemy?.scale ?? 1), y: Math.abs(enemy?.visual?.scaleY ?? enemy?.scale ?? 1) } }

function addChargeWarning(scene, enemy, player) {
  if (!scene?.add?.rectangle || !enemy || !player) return
  const profile = bossTelegraphProfile('charge', enemy), dx = (player.state?.x ?? enemy.x) - enemy.x, dy = (player.state?.y ?? enemy.y) - enemy.y, distance = Math.hypot(dx, dy) || 1, rotation = Math.atan2(dy, dx), x = enemy.x + dx / 2, y = enemy.y + dy / 2
  const band = scene.add.rectangle(x, y, distance, profile.width, 0xff493f, profile.alpha).setOrigin?.(0.5).setRotation?.(rotation).setDepth?.(22)
  const core = scene.add.rectangle(x, y, distance, 2, 0xffd0a8, 0.82).setOrigin?.(0.5).setRotation?.(rotation).setDepth?.(23)
  scene.tweens?.add?.({ targets: band, alpha: profile.alpha * 1.7, duration: 210, yoyo: true, onComplete: () => band?.destroy?.() })
  scene.tweens?.add?.({ targets: core, alpha: 0.28, duration: 210, yoyo: true, onComplete: () => core?.destroy?.() })
}

function addShockwaveWarning(scene, enemy) {
  if (!scene?.add?.circle || !enemy) return
  const profile = bossTelegraphProfile('shockwave', enemy)
  const fill = scene.add.circle(enemy.x, enemy.y, profile.radius, 0xff5a47, profile.alpha * 0.45).setDepth?.(21)
  const outer = scene.add.circle(enemy.x, enemy.y, profile.radius, 0xff5a47, 0.02).setStrokeStyle?.(4, 0xff8a63, 0.88).setDepth?.(23)
  const inner = scene.add.circle(enemy.x, enemy.y, 28, 0xffc18f, 0.04).setStrokeStyle?.(3, 0xffd0a8, 0.82).setDepth?.(24)
  scene.tweens?.add?.({ targets: fill, alpha: profile.alpha, duration: 280, yoyo: true, onComplete: () => fill?.destroy?.() })
  scene.tweens?.add?.({ targets: outer, alpha: 0.38, duration: 280, yoyo: true, onComplete: () => outer?.destroy?.() })
  scene.tweens?.add?.({ targets: inner, radius: profile.radius, alpha: 0.12, duration: profile.windupMs, onComplete: () => inner?.destroy?.() })
}

function chargePose(scene, enemy, player) {
  if (!enemy?.visual || !player) return
  const profile = bossActionProfile('charge', enemy), scale = baseScale(enemy), dx = (player.state?.x ?? enemy.x) - enemy.x, dy = (player.state?.y ?? enemy.y) - enemy.y, distance = Math.hypot(dx, dy) || 1
  scene.tweens?.add?.({ targets: enemy.visual, x: enemy.x - (dx / distance) * profile.recoilPx, y: enemy.y - (dy / distance) * profile.recoilPx, scaleX: scale.x * profile.gatherScaleX, scaleY: scale.y * profile.gatherScaleY, duration: profile.windupMs, ease: 'Quad.Out' })
  scene.time?.delayedCall?.(profile.windupMs, () => { if (enemy.hp <= 0 || enemy.visual?.active === false) return; enemy.visual.setPosition?.(enemy.x, enemy.y); scene.tweens?.add?.({ targets: enemy.visual, scaleX: scale.x * profile.releaseScaleX, scaleY: scale.y * profile.releaseScaleY, duration: profile.releaseMs, yoyo: true, onComplete: () => enemy.visual?.setScale?.(scale.x, scale.y) }) })
}

function shockwavePose(scene, enemy) {
  if (!enemy?.visual) return
  const profile = bossActionProfile('shockwave', enemy), scale = baseScale(enemy)
  scene.tweens?.add?.({ targets: enemy.visual, scaleX: scale.x * profile.gatherScale, scaleY: scale.y * profile.gatherScale, duration: profile.windupMs, ease: 'Sine.In' })
  scene.time?.delayedCall?.(profile.windupMs, () => { if (enemy.hp <= 0 || enemy.visual?.active === false) return; scene.tweens?.add?.({ targets: enemy.visual, scaleX: scale.x * profile.stompScaleX, scaleY: scale.y * profile.stompScaleY, duration: profile.stompMs, yoyo: true, onComplete: () => enemy.visual?.setScale?.(scale.x, scale.y) }) })
}

export function installDungeonEnemyFeedback(scene, { player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonEnemyFeedback) return scene?.__dungeonEnemyFeedback ?? null
  installDungeonEnemyBehaviors(scene, { player })
  const originalBossCharge = typeof scene.bossCharge === 'function' ? scene.bossCharge.bind(scene) : null
  const originalBossShockwave = typeof scene.bossShockwave === 'function' ? scene.bossShockwave.bind(scene) : null
  if (originalBossCharge) scene.bossCharge = function feedbackBossCharge(enemy, target = player) { addChargeWarning(scene, enemy, target); chargePose(scene, enemy, target); return originalBossCharge(enemy, target) }
  if (originalBossShockwave) scene.bossShockwave = function feedbackBossShockwave(enemy, target = player) { addShockwaveWarning(scene, enemy); shockwavePose(scene, enemy); return originalBossShockwave(enemy, target) }

  const hit = (enemy, origin, options = {}) => {
    if (!enemy?.visual) return
    const profile = enemyHitProfile({ ...options, elite: enemy.elite, boss: enemy.boss }), dx = enemy.x - (origin?.x ?? enemy.x), dy = enemy.y - (origin?.y ?? enemy.y), distance = Math.hypot(dx, dy) || 1, scale = baseScale(enemy)
    scene.tweens?.add?.({ targets: enemy.visual, x: enemy.x + (dx / distance) * profile.recoilPx, y: enemy.y + (dy / distance) * profile.recoilPx, scaleX: scale.x * profile.squashX, scaleY: scale.y * profile.squashY, duration: profile.durationMs, yoyo: true, onComplete: () => { if (enemy.hp > 0 && enemy.visual?.active !== false) { enemy.visual.setPosition?.(enemy.x, enemy.y); enemy.visual.setScale?.(scale.x, scale.y) } } })
  }
  const death = (enemy) => { if (!enemy?.visual || enemy.__deathFeedbackPlayed) return; enemy.__deathFeedbackPlayed = true; const profile = enemyDeathProfile({ elite: enemy.elite, boss: enemy.boss }), scale = baseScale(enemy); enemy.visual.setVisible?.(true); scene.tweens?.add?.({ targets: enemy.visual, y: enemy.y - profile.liftPx, alpha: 0, scaleX: scale.x * profile.endScale, scaleY: scale.y * profile.endScale * 0.72, angle: (enemy.visual.angle ?? 0) + profile.rotation, duration: profile.durationMs, ease: 'Quad.In' }) }
  const phaseTwo = (enemy) => { if (!enemy?.visual || enemy.__phaseTwoFeedbackPlayed) return; enemy.__phaseTwoFeedbackPlayed = true; const profile = bossActionProfile('phase-two', enemy), scale = baseScale(enemy); const ring = scene.add?.circle?.(enemy.x, enemy.y, 22, 0xff705c, 0.08)?.setStrokeStyle?.(5, 0xff9b76, 0.88)?.setDepth?.(25); if (ring) scene.tweens?.add?.({ targets: ring, radius: profile.radius, alpha: 0, duration: profile.durationMs, onComplete: () => ring.destroy?.() }); scene.tweens?.add?.({ targets: enemy.visual, scaleX: scale.x * profile.burstScale, scaleY: scale.y * profile.burstScale, duration: Math.round(profile.durationMs * 0.48), yoyo: true, onComplete: () => enemy.visual?.setScale?.(scale.x, scale.y) }) }
  const playerHit = ({ boss = false, damage = 0 } = {}) => { if (!boss) return; const profile = bossPlayerHitProfile({ damage }); scene.cameras?.main?.shake?.(profile.shakeMs, profile.shake) }
  const restore = () => { if (originalBossCharge) scene.bossCharge = originalBossCharge; if (originalBossShockwave) scene.bossShockwave = originalBossShockwave; scene.__dungeonEnemyBehaviors?.restore?.(); scene.__dungeonEnemyFeedback = null }
  scene.events?.once?.('shutdown', restore); scene.events?.once?.('destroy', restore)
  const api = { hit, death, phaseTwo, playerHit, restore }; scene.__dungeonEnemyFeedback = api; return api
}
