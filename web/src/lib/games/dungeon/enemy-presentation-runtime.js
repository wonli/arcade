import { elitePresentation } from './combat-feel.js'

function enemyBarShape(enemy) {
  if (enemy?.boss) return { width: 150, height: 11, color: 0xffc857 }
  if (enemy?.archetype === 'brute') return { width: 46, height: 7, color: 0xff5964 }
  return { width: 36, height: 5, color: 0xff5964 }
}

function killTween(scene, object) {
  if (object) scene?.tweens?.killTweensOf?.(object)
}

export function installEnemyPresentationRuntime(scene) {
  if (!scene || typeof scene !== 'object') return null
  if (scene.__dungeonEnemyPresentation) return scene.__dungeonEnemyPresentation

  const destroyAura = (enemy) => {
    if (!enemy?.eliteAura) return
    killTween(scene, enemy.eliteAura)
    enemy.eliteAura.destroy?.()
    enemy.eliteAura = null
    enemy.__dungeonAuraBoss = undefined
  }

  const ensureAura = (enemy, { boss = Boolean(enemy?.boss) } = {}) => {
    if (!enemy || (!enemy.elite && !boss)) {
      destroyAura(enemy)
      return null
    }
    if (enemy.eliteAura && enemy.__dungeonAuraBoss === Boolean(boss)) return enemy.eliteAura
    destroyAura(enemy)
    if (!scene.add?.circle) return null

    const presentation = elitePresentation({ boss })
    const aura = scene.add.circle(enemy.x, enemy.y + 8, presentation.auraRadius, presentation.auraColor, boss ? 0.08 : 0.06)
      .setStrokeStyle?.(boss ? 3 : 2, presentation.auraColor, boss ? 0.78 : 0.64)
      ?.setDepth?.(Math.max(7, (enemy.visual?.depth ?? 20) - 1))
    if (!aura) return null
    aura.setScale?.(1, 0.42)
    scene.tweens?.add?.({
      targets: aura,
      scaleX: boss ? 1.28 : 1.2,
      scaleY: boss ? 0.54 : 0.5,
      alpha: boss ? 0.24 : 0.18,
      duration: presentation.pulseMs,
      yoyo: true,
      repeat: -1,
    })
    enemy.eliteAura = aura
    enemy.__dungeonAuraBoss = Boolean(boss)
    return aura
  }

  const syncAura = (enemy) => {
    const aura = enemy?.eliteAura
    if (!aura) return
    if (Number(enemy.hp) <= 0 || enemy.visual?.active === false) {
      destroyAura(enemy)
      return
    }
    aura.setPosition?.(enemy.x, enemy.y + Math.max(6, (enemy.barOffset ?? 24) * 0.2))
  }

  const sync = (enemy) => {
    if (!enemy) return null
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
    scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - (enemy.barOffset ?? 28), enemy.hp, enemy.maxHp)
    if (enemy.elite || enemy.boss) ensureAura(enemy, { boss: Boolean(enemy.boss) })
    else destroyAura(enemy)
    syncAura(enemy)
    return enemy
  }

  const destroy = (enemy) => {
    if (!enemy) return null
    destroyAura(enemy)
    if (enemy.healthBar) {
      scene.destroyHealthBar?.(enemy.healthBar)
      enemy.healthBar = null
    }
    if (enemy.visual) {
      killTween(scene, enemy.visual)
      enemy.visual.destroy?.()
      enemy.visual = null
    }
    return enemy
  }

  const removeById = (id) => {
    const normalized = String(id ?? '')
    const enemy = (scene.enemies ?? []).find((candidate) => String(candidate?.id ?? '') === normalized) ?? null
    if (!enemy) return null
    destroy(enemy)
    scene.enemies = (scene.enemies ?? []).filter((candidate) => candidate !== enemy)
    return enemy
  }

  const clearAll = () => {
    for (const enemy of [...(scene.enemies ?? [])]) destroy(enemy)
    scene.enemies = []
  }

  const rebuild = (enemy) => {
    if (!enemy || typeof scene.makeActor !== 'function') return sync(enemy)
    destroy(enemy)
    const visual = scene.makeActor(enemy.x, enemy.y, 'enemy', enemy.archetype)
    if (visual) {
      visual.setDepth?.(enemy.elite ? 12 : 10)
      const scale = Number(enemy.scale) || 1
      visual.setScale?.((visual.scaleX ?? 1) * scale, (visual.scaleY ?? 1) * scale)
      if (enemy.tint != null) visual.setTint?.(enemy.tint)
      enemy.visual = visual
    }
    const bar = enemyBarShape(enemy)
    enemy.healthBar = scene.createHealthBar?.(enemy.x, enemy.y - (enemy.barOffset ?? 28), bar.width, bar.height, bar.color) ?? null
    return sync(enemy)
  }

  const reconcile = (enemy, previous = null) => {
    if (!enemy) return null
    const changed = Boolean(previous) && (
      previous.archetype !== enemy.archetype ||
      Boolean(previous.boss) !== Boolean(enemy.boss) ||
      Boolean(previous.elite) !== Boolean(enemy.elite)
    )
    if (changed) return rebuild(enemy)
    return sync(enemy)
  }

  const syncAllAuras = () => {
    for (const enemy of scene.enemies ?? []) syncAura(enemy)
  }
  scene.events?.on?.('update', syncAllAuras)

  let api = null
  const restore = () => {
    scene.events?.off?.('update', syncAllAuras)
    if (scene.__dungeonEnemyPresentation === api) scene.__dungeonEnemyPresentation = null
  }

  api = { ensureAura, sync, reconcile, destroy, removeById, clearAll, restore }
  scene.__dungeonEnemyPresentation = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
