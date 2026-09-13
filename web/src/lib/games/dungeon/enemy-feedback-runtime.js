export function enemyHitProfile({ critical = false, elite = false, boss = false, damage = 0 } = {}) {
  const weight = Math.max(0, Math.min(1, Number(damage || 0) / 80))
  const base = 5 + weight * 3 + (critical ? 3 : 0) + (elite ? 1 : 0)
  return {
    recoilPx: Number((boss ? base * 0.32 : base).toFixed(2)),
    durationMs: boss ? 82 : critical ? 125 : 96,
    squashX: critical ? 1.1 : 1.06,
    squashY: critical ? 0.88 : 0.92,
  }
}

export function enemyDeathProfile({ elite = false, boss = false } = {}) {
  if (boss) return { durationMs: 290, endScale: 0.68, liftPx: 10, rotation: 7 }
  if (elite) return { durationMs: 250, endScale: 0.62, liftPx: 8, rotation: 10 }
  return { durationMs: 205, endScale: 0.55, liftPx: 6, rotation: 12 }
}

export function bossTelegraphProfile(kind, { phase = 1 } = {}) {
  const phaseTwo = phase >= 2
  if (kind === 'charge') {
    return { windupMs: 420, shapeCount: 2, width: phaseTwo ? 28 : 24, alpha: phaseTwo ? 0.34 : 0.27 }
  }
  return { windupMs: 560, shapeCount: 3, radius: 130, alpha: phaseTwo ? 0.26 : 0.2 }
}

export function installDungeonEnemyFeedback(scene) {
  if (!scene || scene.__dungeonEnemyFeedback) return scene?.__dungeonEnemyFeedback ?? null

  const hit = (enemy, origin, options = {}) => {
    if (!enemy?.visual) return
    const profile = enemyHitProfile({ ...options, elite: enemy.elite, boss: enemy.boss })
    const dx = enemy.x - (origin?.x ?? enemy.x)
    const dy = enemy.y - (origin?.y ?? enemy.y)
    const distance = Math.hypot(dx, dy) || 1
    const baseScaleX = Math.abs(enemy.visual.scaleX ?? enemy.scale ?? 1)
    const baseScaleY = Math.abs(enemy.visual.scaleY ?? enemy.scale ?? 1)
    scene.tweens?.add?.({
      targets: enemy.visual,
      x: enemy.x + (dx / distance) * profile.recoilPx,
      y: enemy.y + (dy / distance) * profile.recoilPx,
      scaleX: baseScaleX * profile.squashX,
      scaleY: baseScaleY * profile.squashY,
      duration: profile.durationMs,
      yoyo: true,
      onComplete: () => {
        if (enemy.hp > 0 && enemy.visual?.active !== false) {
          enemy.visual.setPosition?.(enemy.x, enemy.y)
          enemy.visual.setScale?.(baseScaleX, baseScaleY)
        }
      },
    })
  }

  const death = (enemy) => {
    if (!enemy?.visual || enemy.__deathFeedbackPlayed) return
    enemy.__deathFeedbackPlayed = true
    const profile = enemyDeathProfile({ elite: enemy.elite, boss: enemy.boss })
    const baseScaleX = Math.abs(enemy.visual.scaleX ?? enemy.scale ?? 1)
    const baseScaleY = Math.abs(enemy.visual.scaleY ?? enemy.scale ?? 1)
    enemy.visual.setVisible?.(true)
    scene.tweens?.add?.({
      targets: enemy.visual,
      y: enemy.y - profile.liftPx,
      alpha: 0,
      scaleX: baseScaleX * profile.endScale,
      scaleY: baseScaleY * profile.endScale * 0.72,
      angle: (enemy.visual.angle ?? 0) + profile.rotation,
      duration: profile.durationMs,
      ease: 'Quad.In',
    })
  }

  const restore = () => { scene.__dungeonEnemyFeedback = null }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  const api = { hit, death, restore }
  scene.__dungeonEnemyFeedback = api
  return api
}
