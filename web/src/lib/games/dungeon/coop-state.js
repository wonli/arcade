import { applyPlayerContextSnapshot, snapshotPlayerContext } from './player-context.js'

function clone(value) {
  if (value == null) return value
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

export function dungeonRoomRole(room, playerId) {
  const players = room?.players ?? []
  if (!players.some((player) => player.id === playerId)) return 'spectator'
  if (players.length < 2) return 'waiting'
  return room?.hostId === playerId ? 'host' : 'guest'
}

export function shouldIncludeGeometry(sequence, geometryVersion, lastGeometryVersion, every = 20) {
  return sequence <= 2 || geometryVersion !== lastGeometryVersion || sequence % every === 0
}

export function geometrySignature(geometry) {
  if (!geometry) return ''
  return JSON.stringify([
    geometry.seed ?? null,
    geometry.width ?? 0,
    geometry.height ?? 0,
    geometry.roomId ?? geometry.id ?? null,
    geometry.grid?.width ?? 0,
    geometry.grid?.height ?? 0,
    (geometry.solids ?? []).length,
    (geometry.water ?? []).length,
    (geometry.traps ?? []).length,
  ])
}

export function dropSignature(items = []) {
  return JSON.stringify(items.map((entry) => [
    entry?.x ?? 0,
    entry?.y ?? 0,
    entry?.item?.type ?? '',
    entry?.item?.archetype ?? '',
    entry?.item?.rarity ?? '',
    entry?.item?.damage ?? 0,
  ]))
}

export function createDungeonCoopSnapshot(scene, progress = {}, { sequence = 0, includeGeometry = false } = {}) {
  const players = scene?.__dungeonPlayerRuntime?.activePlayers?.() ?? [scene?.localPlayer].filter(Boolean)
  const snapshot = {
    sequence,
    floor: scene?.floor ?? progress?.floor ?? 1,
    floorCleared: Boolean(scene?.floorCleared),
    runComplete: Boolean(scene?.runComplete),
    dead: Boolean(scene?.dead),
    progress: clone(progress ?? {}),
    players: players.map(snapshotPlayerContext).filter(Boolean),
    enemies: (scene?.enemies ?? []).filter((enemy) => enemy?.hp > 0).map((enemy) => ({
      id: enemy.id,
      x: Number(enemy.x) || 0,
      y: Number(enemy.y) || 0,
      hp: Number(enemy.hp) || 0,
      maxHp: Number(enemy.maxHp) || 1,
      archetype: enemy.archetype,
      elite: Boolean(enemy.elite),
      boss: Boolean(enemy.boss),
      phase: enemy.phase ?? 1,
      scale: enemy.scale ?? 1,
      tint: enemy.tint ?? null,
      barOffset: enemy.barOffset ?? 28,
    })),
    drops: (scene?.drops ?? []).filter(Boolean).map((drop) => ({
      x: Number(drop.x) || 0,
      y: Number(drop.y) || 0,
      item: clone(drop.item ?? null),
    })),
    portal: scene?.portal ? {
      x: Number(scene.portal.x) || 0,
      y: Number(scene.portal.y) || 0,
      unlockAt: Number(scene.portal.unlockAt) || 0,
    } : null,
  }
  if (includeGeometry && scene?.__roomGeometry) snapshot.geometry = clone(scene.__roomGeometry)
  return snapshot
}

export function reconcilePredictedPlayer(player, authoritative, { softDistance = 36, hardDistance = 96 } = {}) {
  if (!player || !authoritative) return player
  const target = authoritative.state ?? {}
  const current = player.state ?? {}
  const gap = Math.hypot((target.x ?? 0) - (current.x ?? 0), (target.y ?? 0) - (current.y ?? 0))
  if (gap >= hardDistance) return applyPlayerContextSnapshot(player, authoritative)
  applyPlayerContextSnapshot(player, authoritative, { preservePosition: gap <= softDistance })
  if (gap > softDistance && player.state) {
    player.state.x = (current.x ?? 0) + ((target.x ?? 0) - (current.x ?? 0)) * 0.45
    player.state.y = (current.y ?? 0) + ((target.y ?? 0) - (current.y ?? 0)) * 0.45
  }
  return player
}

export function applyEnemySnapshot(scene, authoritative = []) {
  if (!scene) return
  scene.enemies ??= []
  const byId = new Map(scene.enemies.filter(Boolean).map((enemy) => [enemy.id, enemy]))
  const nextEnemies = []

  const createMirror = (next) => {
    const visual = scene.makeActor?.(next.x, next.y, 'enemy', next.archetype ?? 'skeleton')?.setDepth?.(next.elite ? 12 : 10) ?? null
    if (visual && next.scale && next.scale !== 1) visual.setScale?.(visual.scaleX * next.scale, visual.scaleY * next.scale)
    if (visual && next.tint != null) visual.setTint?.(next.tint)
    const boss = Boolean(next.boss)
    const barWidth = boss ? 150 : next.archetype === 'brute' ? 46 : 36
    const barHeight = boss ? 11 : next.archetype === 'brute' ? 7 : 5
    const barOffset = next.barOffset ?? (boss ? 58 : 28)
    return {
      id: next.id,
      x: next.x,
      y: next.y,
      hp: next.hp,
      maxHp: next.maxHp,
      archetype: next.archetype,
      elite: Boolean(next.elite),
      boss,
      phase: next.phase ?? 1,
      scale: next.scale ?? 1,
      tint: next.tint ?? null,
      barOffset,
      visual,
      healthBar: scene.createHealthBar?.(next.x, next.y - barOffset, barWidth, barHeight, boss ? 0xffc857 : 0xff5964) ?? null,
    }
  }

  for (const next of authoritative) {
    let enemy = byId.get(next.id) ?? null
    if (enemy && enemy.archetype !== next.archetype) {
      enemy.visual?.destroy?.()
      scene.destroyHealthBar?.(enemy.healthBar)
      enemy = null
    }
    enemy ??= createMirror(next)
    enemy.id = next.id ?? enemy.id
    enemy.x = Number(next.x) || 0
    enemy.y = Number(next.y) || 0
    enemy.hp = Math.max(0, Number(next.hp) || 0)
    enemy.maxHp = Math.max(1, Number(next.maxHp) || 1)
    enemy.archetype = next.archetype ?? enemy.archetype
    enemy.elite = Boolean(next.elite)
    enemy.boss = Boolean(next.boss)
    enemy.phase = next.phase ?? enemy.phase ?? 1
    enemy.scale = next.scale ?? enemy.scale ?? 1
    enemy.tint = next.tint ?? enemy.tint ?? null
    enemy.barOffset = next.barOffset ?? enemy.barOffset ?? 28
    enemy.visual?.setVisible?.(enemy.hp > 0)
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
    if (enemy.healthBar) scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
    nextEnemies.push(enemy)
    byId.delete(next.id)
  }

  for (const enemy of byId.values()) {
    enemy.visual?.destroy?.()
    scene.destroyHealthBar?.(enemy.healthBar)
  }
  scene.enemies = nextEnemies
}

export function applyDropSnapshot(scene, authoritative = []) {
  const nextSignature = dropSignature(authoritative)
  if (scene.__coopDropSignature === nextSignature) return
  scene.__coopDropSignature = nextSignature
  scene.clearDrops?.()
  for (const drop of authoritative) {
    scene.__dungeonPickupRuntime?.spawnExact?.(drop.x, drop.y, clone(drop.item))
      ?? scene.spawnDrop?.(drop.x, drop.y, clone(drop.item))
  }
}
