export function multiplayerRole(room, playerId) {
  const players = room?.players ?? []
  if (!players.some((player) => player.id === playerId)) return 'spectator'
  if (players.length < 2) return 'waiting'
  return room?.hostId === playerId ? 'host' : 'guest'
}

function clone(value) {
  if (value == null) return value
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function playerSnapshot(state = {}, facing = state.facing ?? 'down', moving = state.moving ?? false, attacking = state.attacking ?? false) {
  return {
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
    hp: Number(state.hp) || 0,
    maxHp: Number(state.maxHp) || 0,
    damage: Number(state.damage) || 0,
    critChance: Number(state.critChance) || 0,
    critMultiplier: Number(state.critMultiplier) || 2,
    speed: Number(state.speed) || 0,
    weapon: clone(state.weapon ?? null),
    weaponRarity: state.weaponRarity ?? null,
    weaponDamage: Number(state.weaponDamage) || 0,
    weaponAffixes: clone(Array.isArray(state.weaponAffixes) ? state.weaponAffixes : []),
    effects: clone(state.effects ?? {}),
    hasteUntil: Number(state.hasteUntil) || 0,
    facing,
    moving: Boolean(moving),
    attacking: Boolean(attacking),
  }
}

export function createDungeonSnapshot(scene, peerState, progress = {}, { includeGeometry = false } = {}) {
  const snapshot = {
    floor: scene?.floor ?? progress?.floor ?? 1,
    floorCleared: Boolean(scene?.floorCleared),
    runComplete: Boolean(scene?.runComplete),
    dead: Boolean(scene?.dead),
    progress: clone(progress ?? {}),
    host: playerSnapshot(scene?.playerState, scene?.playerFacing, scene?.playerMoving, scene?.playerAttacking),
    peer: playerSnapshot(peerState, peerState?.facing, peerState?.moving, peerState?.attacking),
    enemies: (scene?.enemies ?? []).filter((enemy) => enemy?.hp > 0).map((enemy) => ({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      archetype: enemy.archetype,
      elite: Boolean(enemy.elite),
      boss: Boolean(enemy.boss),
      phase: enemy.phase ?? 1,
      scale: enemy.scale ?? 1,
      tint: enemy.tint ?? null,
      barOffset: enemy.barOffset ?? 28,
    })),
    drops: (scene?.drops ?? []).map((drop) => ({ x: drop.x, y: drop.y, item: clone(drop.item ?? null) })),
    portal: scene?.portal ? { x: scene.portal.x, y: scene.portal.y, unlockAt: scene.portal.unlockAt ?? 0 } : null,
  }
  if (includeGeometry && scene?.__roomGeometry) snapshot.geometry = clone(scene.__roomGeometry)
  return snapshot
}

export function applyEnemySnapshot(scene, authoritative = []) {
  if (!scene) return
  scene.enemies ??= []

  const createMirror = (next) => {
    if (typeof scene.makeActor !== 'function') {
      const before = scene.enemies.length
      scene.spawnEnemy?.(before)
      return scene.enemies[before] ?? null
    }
    const visual = scene.makeActor(next.x, next.y, 'enemy', next.archetype ?? 'skeleton')?.setDepth?.(next.elite ? 12 : 10)
    if (visual && next.scale && next.scale !== 1) visual.setScale?.(visual.scaleX * next.scale, visual.scaleY * next.scale)
    if (visual && next.tint != null) visual.setTint?.(next.tint)
    const boss = Boolean(next.boss)
    const barWidth = boss ? 150 : next.archetype === 'brute' ? 46 : 36
    const barHeight = boss ? 11 : next.archetype === 'brute' ? 7 : 5
    const barOffset = next.barOffset ?? (boss ? 58 : 28)
    const enemy = {
      id: next.id, x: next.x, y: next.y, hp: next.hp, maxHp: next.maxHp,
      archetype: next.archetype, elite: Boolean(next.elite), boss, phase: next.phase ?? 1,
      scale: next.scale ?? 1, tint: next.tint ?? null, barOffset, visual,
      healthBar: scene.createHealthBar?.(next.x, next.y - barOffset, barWidth, barHeight, boss ? 0xffc857 : 0xff5964) ?? null,
    }
    scene.enemies.push(enemy)
    return enemy
  }

  const byId = new Map(scene.enemies.filter(Boolean).map((enemy) => [enemy.id, enemy]))
  const nextEnemies = []
  for (const next of authoritative) {
    let enemy = byId.get(next.id) ?? null
    if (enemy && enemy.archetype !== next.archetype && typeof scene.makeActor === 'function') {
      enemy.visual?.destroy?.()
      scene.destroyHealthBar?.(enemy.healthBar)
      const index = scene.enemies.indexOf(enemy)
      if (index >= 0) scene.enemies.splice(index, 1)
      enemy = null
    }
    enemy ??= createMirror(next)
    if (!enemy) continue
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

export function applyPlayerSnapshot(target, source, { preservePosition = false } = {}) {
  if (!target || !source) return target
  const x = target.x
  const y = target.y
  for (const key of ['hp','maxHp','damage','critChance','critMultiplier','speed','weapon','weaponRarity','weaponDamage','weaponAffixes','effects','hasteUntil']) {
    if (key in source) target[key] = clone(source[key])
  }
  if (!preservePosition) {
    target.x = Number(source.x) || 0
    target.y = Number(source.y) || 0
  } else {
    target.x = x
    target.y = y
  }
  return target
}

export function shouldIncludeGeometry(sequence, every = 20) {
  return sequence <= 3 || sequence % every === 0
}

export function snapshotSignature(items = []) {
  return JSON.stringify(items.map((entry) => [entry?.x ?? 0, entry?.y ?? 0, entry?.item?.type ?? '', entry?.item?.rarity ?? '', entry?.item?.damage ?? 0]))
}
