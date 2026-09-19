import { ensureDungeonEnemyRuntime } from './enemy-runtime.js'
import { installEnemyPresentationRuntime } from './enemy-presentation-runtime.js'
import { ensureDungeonLootRuntime } from './loot-runtime.js'
import { installPortalPresentationRuntime } from './portal-presentation-runtime.js'
import { installDungeonProjectilePresentation } from './projectile-presentation-runtime.js'
import { applyEquipmentState } from './player-loadout.js'
import { despawnRemotePlayer, spawnRemotePlayer, syncRemotePlayerPresentation } from './remote-player-runtime.js'

export function createDungeonWorldStateMaterializer(scene, dependencies = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')

  const enemyRuntime = dependencies.enemyRuntime ?? ensureDungeonEnemyRuntime(scene)
  const enemyPresentation = dependencies.enemyPresentation ?? installEnemyPresentationRuntime(scene)
  const loot = dependencies.loot ?? ensureDungeonLootRuntime(scene)
  const portalPresentation = dependencies.portalPresentation ?? installPortalPresentationRuntime(scene)
  const projectilePresentation = dependencies.projectilePresentation ?? installDungeonProjectilePresentation(scene)
  const spawnRemote = dependencies.spawnRemote ?? spawnRemotePlayer
  const syncRemote = dependencies.syncRemote ?? syncRemotePlayerPresentation
  const despawnRemote = dependencies.despawnRemote ?? despawnRemotePlayer

  function apply(state = {}) {
    applySceneState(state.scene ?? {})
    applyPlayers(state.players ?? [])
    applyEnemies(state.enemies ?? [])
    applyDrops(state.drops ?? [])
    applyProjectiles(state.projectiles ?? [])
    scene.kills = finiteNumber(state.stats?.kills, scene.kills ?? 0)
    scene.emitStats?.()
    return scene
  }

  function applySceneState(value = {}) {
    const previous = scene.__replaySceneState ?? null
    const roomChanged = previous != null && !sameReplayScene(previous, value)

    if (Number.isFinite(Number(value.floor))) scene.floor = Math.max(1, Math.round(Number(value.floor)))
    scene.__replaySceneState = {
      ...(scene.__replaySceneState ?? {}),
      ...plainClone(value),
    }

    if (roomChanged) scene.__dungeonSpatial?.refreshRoom?.()

    if (value.portal) {
      portalPresentation?.ensure?.({
        id: value.portal.id ?? `portal:${scene.floor ?? 1}`,
        x: finiteNumber(value.portal.x),
        y: finiteNumber(value.portal.y),
        unlockAt: scene.time?.now ?? 0,
      })
    } else portalPresentation?.remove?.()
  }

  function applyPlayers(values) {
    const snapshots = Array.isArray(values) ? values.filter(Boolean) : []
    if (!snapshots.length || !scene.localPlayer) return

    const preferredLocal = snapshots.find((entry) => String(entry.id) === String(scene.localPlayer.id))
      ?? snapshots.find((entry) => Number(entry.slot) === 0)
      ?? snapshots[0]
    rekeyLocalPlayer(preferredLocal.id)
    applyPlayer(scene.localPlayer, preferredLocal)
    syncLocalPlayer(scene.localPlayer)

    const wanted = new Set([String(scene.localPlayer.id)])
    for (const snapshot of snapshots) {
      const id = String(snapshot?.id ?? '')
      if (!id || id === String(scene.localPlayer.id)) continue
      wanted.add(id)
      let player = scene.players instanceof Map ? scene.players.get(id) : null
      if (!player) {
        player = spawnRemote(scene, semanticPlayerSnapshot(snapshot))
      } else {
        applyPlayer(player, snapshot)
        syncRemote(scene, player)
      }
    }

    if (scene.players instanceof Map) {
      for (const [id, player] of [...scene.players]) {
        if (player === scene.localPlayer || wanted.has(String(id))) continue
        despawnRemote(scene, id)
      }
    }
  }

  function rekeyLocalPlayer(nextId) {
    const normalized = String(nextId ?? '').trim()
    if (!normalized || normalized === String(scene.localPlayer.id)) return
    if (scene.players instanceof Map) {
      scene.players.delete(String(scene.localPlayer.id))
      scene.players.set(normalized, scene.localPlayer)
    }
    scene.localPlayer.id = normalized
  }

  function applyPlayer(player, snapshot = {}) {
    const existing = player.state ?? {}
    const weapon = snapshot.weapon ?? existing.equipment?.weapon ?? null
    let nextState = {
      ...existing,
      x: finiteNumber(snapshot.x, existing.x),
      y: finiteNumber(snapshot.y, existing.y),
      hp: Math.max(0, finiteNumber(snapshot.hp, existing.hp)),
      maxHp: Math.max(1, finiteNumber(snapshot.maxHp, existing.maxHp ?? 100)),
    }
    nextState = applyEquipmentState(nextState, weapon, snapshot.effects ?? {})
    player.state = nextState
    if (Number.isInteger(snapshot.slot)) player.slot = snapshot.slot
    player.facing = snapshot.facing ?? player.facing ?? 'down'
    player.moving = Boolean(snapshot.moving)
    player.attacking = Boolean(snapshot.attacking)
    player.dead = Boolean(snapshot.dead)
    return player
  }

  function syncLocalPlayer(player) {
    player.actor?.setPosition?.(player.state.x, player.state.y)
    scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
    player.runtime?.weaponVisuals?.sync?.()
    scene.syncPlayerAnimation?.(null, player)
  }

  function semanticPlayerSnapshot(snapshot) {
    return {
      id: String(snapshot.id),
      slot: Number.isInteger(snapshot.slot) ? snapshot.slot : null,
      state: applyEquipmentState({
        x: finiteNumber(snapshot.x),
        y: finiteNumber(snapshot.y),
        hp: Math.max(0, finiteNumber(snapshot.hp)),
        maxHp: Math.max(1, finiteNumber(snapshot.maxHp, 100)),
      }, snapshot.weapon ?? null, snapshot.effects ?? {}),
      facing: snapshot.facing ?? 'down',
      moving: Boolean(snapshot.moving),
      attacking: Boolean(snapshot.attacking),
      dead: Boolean(snapshot.dead),
    }
  }

  function applyEnemies(values) {
    const snapshots = Array.isArray(values) ? values.filter(Boolean) : []
    const existingById = new Map((scene.enemies ?? []).map((enemy) => [String(enemy?.id ?? ''), enemy]))
    const next = []

    for (let index = 0; index < snapshots.length; index++) {
      const snapshot = snapshots[index]
      const id = String(snapshot?.id ?? `enemy-${index}`)
      let enemy = existingById.get(id) ?? null
      if (!enemy) enemy = enemyRuntime?.spawn?.(index, { elite: Boolean(snapshot.elite) }, { source: 'replay-state' }) ?? null
      if (!enemy) continue
      existingById.delete(id)
      const previous = { archetype: enemy.archetype, elite: enemy.elite, boss: enemy.boss }
      enemy.id = id
      enemy.x = finiteNumber(snapshot.x, enemy.x)
      enemy.y = finiteNumber(snapshot.y, enemy.y)
      enemy.hp = Math.max(0, finiteNumber(snapshot.hp, enemy.hp))
      enemy.maxHp = Math.max(1, finiteNumber(snapshot.maxHp, enemy.maxHp ?? 1))
      enemy.archetype = snapshot.archetype ?? enemy.archetype ?? 'skeleton'
      enemy.elite = Boolean(snapshot.elite)
      enemy.boss = Boolean(snapshot.boss)
      enemy.phase = snapshot.phase ?? enemy.phase ?? null
      enemy.facing = snapshot.facing ?? enemy.facing ?? null
      enemy.moving = Boolean(snapshot.moving)
      enemy.dead = Boolean(snapshot.dead)
      enemyPresentation?.reconcile?.(enemy, previous)
      next.push(enemy)
    }

    for (const enemy of existingById.values()) enemyPresentation?.destroy?.(enemy)
    scene.enemies = next
  }

  function applyDrops(values) {
    const snapshots = Array.isArray(values) ? values.filter((entry) => entry?.item) : []
    const wanted = new Set(snapshots.map((entry, index) => String(entry.id ?? `drop-${index}`)))
    for (const drop of [...(scene.drops ?? [])]) {
      if (!wanted.has(String(drop?.id ?? ''))) loot?.removeById?.(drop.id, { reason: 'replay-state' })
    }

    for (let index = 0; index < snapshots.length; index++) {
      const snapshot = snapshots[index]
      const id = String(snapshot.id ?? `drop-${index}`)
      let drop = (scene.drops ?? []).find((entry) => String(entry?.id ?? '') === id) ?? null
      if (!drop) drop = loot?.spawnExact?.(finiteNumber(snapshot.x), finiteNumber(snapshot.y), plainClone(snapshot.item)) ?? null
      if (!drop) continue
      drop.id = id
      drop.x = finiteNumber(snapshot.x, drop.x)
      drop.y = finiteNumber(snapshot.y, drop.y)
      drop.item = plainClone(snapshot.item)
      drop.visual?.setPosition?.(drop.x, drop.y)
      loot?.reconcilePresentation?.({ reason: 'replay-state', dropId: id })
    }
  }

  function applyProjectiles(values) {
    const snapshots = Array.isArray(values) ? values.filter(Boolean) : []
    const materialized = projectilePresentation?.reconcile?.(snapshots) ?? []
    scene.enemyProjectiles = materialized
  }

  function resetTransient() {
    if (scene.players instanceof Map) {
      for (const [id, player] of [...scene.players]) if (player !== scene.localPlayer) despawnRemote(scene, id)
    }
    enemyPresentation?.clearAll?.()
    loot?.clear?.()
    portalPresentation?.remove?.()
    projectilePresentation?.clear?.()
    scene.enemyProjectiles = []
  }

  return { apply, resetTransient }
}

function sameReplayScene(previous = {}, next = {}) {
  const previousKey = String(previous?.sceneKey ?? '').trim()
  const nextKey = String(next?.sceneKey ?? '').trim()
  if (previousKey || nextKey) return previousKey !== '' && previousKey === nextKey

  return sameOptionalScalar(previous.floor, next.floor)
    && sameOptionalScalar(previous.chapter, next.chapter)
    && sameOptionalScalar(previous.chapterFloor, next.chapterFloor)
    && sameOptionalScalar(previous.roomRole, next.roomRole)
}

function sameOptionalScalar(left, right) {
  if (left == null && right == null) return true
  if (left == null || right == null) return false
  return String(left) === String(right)
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : (Number(fallback) || 0)
}

function plainClone(value) {
  return structuredClone(value ?? null)
}
