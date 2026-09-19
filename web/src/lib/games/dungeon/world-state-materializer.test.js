import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonWorldStateMaterializer } from './world-state-materializer.js'

function objectAt(x = 0, y = 0) {
  return {
    active: true,
    x,
    y,
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this },
    destroy() { this.active = false },
  }
}

function sceneFixture() {
  const local = {
    id: 'local', slot: 0,
    state: { x: 10, y: 20, hp: 100, maxHp: 100, equipment: {}, modifiers: {} },
    facing: 'down', actor: objectAt(), bar: null, runtime: {},
  }
  return {
    localPlayer: local,
    players: new Map([['local', local]]),
    enemies: [], drops: [], enemyProjectiles: [], floor: 1, kills: 0,
    updateHealthBar() {}, syncPlayerAnimation() {}, emitStats() {},
    time: { now: 50 },
  }
}

function dependencies(scene) {
  const remoteDestroyed = []
  const enemiesDestroyed = []
  const loot = {
    spawnExact(x, y, item) {
      const drop = { x, y, item, visual: objectAt(x, y) }
      scene.drops.push(drop)
      return drop
    },
    removeById(id) {
      const drop = scene.drops.find((entry) => entry.id === id)
      if (!drop) return null
      drop.visual?.destroy?.()
      scene.drops = scene.drops.filter((entry) => entry !== drop)
      return drop
    },
    clear() { scene.drops = [] },
    reconcilePresentation() {},
  }
  return {
    remoteDestroyed,
    enemiesDestroyed,
    deps: {
      enemyRuntime: {
        spawn() {
          const enemy = { x: 0, y: 0, hp: 1, maxHp: 1, visual: objectAt() }
          scene.enemies.push(enemy)
          return enemy
        },
      },
      enemyPresentation: {
        reconcile(enemy) { enemy.visual?.setPosition?.(enemy.x, enemy.y) },
        destroy(enemy) { enemiesDestroyed.push(enemy.id); enemy.visual?.destroy?.() },
        clearAll() { scene.enemies = [] },
      },
      loot,
      portalPresentation: {
        ensure(value) { scene.portal = { ...value }; return { portal: scene.portal } },
        remove() { scene.portal = null },
      },
      spawnRemote(targetScene, snapshot) {
        const player = {
          id: snapshot.id, slot: snapshot.slot, state: structuredClone(snapshot.state),
          facing: snapshot.facing, moving: snapshot.moving, attacking: snapshot.attacking, dead: snapshot.dead,
          actor: objectAt(snapshot.state.x, snapshot.state.y), runtime: {},
        }
        targetScene.players.set(player.id, player)
        return player
      },
      syncRemote(targetScene, player) { player.actor?.setPosition?.(player.state.x, player.state.y) },
      despawnRemote(targetScene, id) { remoteDestroyed.push(id); return targetScene.players.delete(id) },
    },
  }
}

const state = (guestX = 300) => ({
  scene: { floor: 3, chapter: 1, chapterFloor: 3, roomRole: 'combat', sceneKey: '3:1:3', portal: { x: 840, y: 300, open: true } },
  players: [
    { id: 'host', slot: 0, x: 120, y: 140, hp: 80, maxHp: 100, facing: 'left', moving: true, weapon: { type: 'weapon.dungeon_blade', rarity: 'rare' }, effects: { haste: 0.2 } },
    { id: 'guest', slot: 1, x: guestX, y: 220, hp: 70, maxHp: 90, facing: 'right', moving: false },
  ],
  enemies: [{ id: 'e1', x: 500, y: 240, hp: 20, maxHp: 50, archetype: 'brute', elite: true, phase: 2 }],
  drops: [{ id: 'd1', x: 430, y: 330, item: { type: 'consumable.health_potion', rarity: 'common' } }],
  projectiles: [{ id: 'p1', kind: 'enemy', ownerId: 'e1', x: 400, y: 200, vx: 50, vy: 0 }],
  stats: { kills: 4 },
})

test('materializer reconciles real scene entities by stable id and is idempotent', () => {
  const scene = sceneFixture()
  const { deps } = dependencies(scene)
  const materializer = createDungeonWorldStateMaterializer(scene, deps)

  materializer.apply(state())
  const enemy = scene.enemies[0]
  const drop = scene.drops[0]
  const guest = scene.players.get('guest')
  assert.equal(scene.localPlayer.id, 'host')
  assert.equal(scene.localPlayer.state.x, 120)
  assert.equal(scene.localPlayer.state.equipment.weapon.rarity, 'rare')
  assert.equal(guest.state.x, 300)
  assert.equal(enemy.id, 'e1')
  assert.equal(drop.id, 'd1')
  assert.equal(scene.enemyProjectiles[0].id, 'p1')
  assert.equal(scene.portal.x, 840)

  materializer.apply(state(360))
  assert.equal(scene.enemies[0], enemy)
  assert.equal(scene.drops[0], drop)
  assert.equal(scene.players.get('guest'), guest)
  assert.equal(guest.state.x, 360)
})

test('materializer rebuilds the spatial room atomically when sceneKey changes', () => {
  const scene = sceneFixture()
  const { deps } = dependencies(scene)
  const refreshes = []
  scene.__replaySceneState = { floor: 3, chapter: 1, chapterFloor: 3, roomRole: 'combat', sceneKey: '3:1:3' }
  scene.__dungeonSpatial = {
    refreshRoom() {
      refreshes.push(structuredClone(scene.__replaySceneState))
      // Live refreshRoom places the player at the new room spawn before the
      // recorded replay frame restores the exact post-transition position.
      scene.localPlayer.state.x = 48
      scene.localPlayer.state.y = 300
    },
  }
  const materializer = createDungeonWorldStateMaterializer(scene, deps)
  const next = state()
  next.scene = { ...next.scene, floor: 4, chapterFloor: 4, sceneKey: '4:1:4', portal: null }
  next.players[0] = { ...next.players[0], x: 132, y: 304 }

  materializer.apply(next)

  assert.equal(refreshes.length, 1)
  assert.equal(refreshes[0].sceneKey, '4:1:4')
  assert.equal(refreshes[0].floor, 4)
  assert.equal(scene.localPlayer.state.x, 132)
  assert.equal(scene.localPlayer.state.y, 304)
})

test('materializer does not cancel an in-flight attack animation when the next frame is non-attacking', () => {
  const scene = sceneFixture()
  const { deps } = dependencies(scene)
  const materializer = createDungeonWorldStateMaterializer(scene, deps)
  const next = state()
  next.players = [
    { ...next.players[0], attacking: false, moving: true },
  ]

  scene.localPlayer.attacking = true
  scene.localPlayer.actor.anims = {
    currentAnim: { key: 'dungeon-player-side-attack' },
    isPlaying: true,
  }

  materializer.apply(next)
  assert.equal(scene.localPlayer.attacking, true)

  scene.localPlayer.actor.anims.isPlaying = false
  materializer.apply(next)
  assert.equal(scene.localPlayer.attacking, false)
})

test('materializer removes entities absent from the next canonical frame', () => {
  const scene = sceneFixture()
  const { deps, remoteDestroyed, enemiesDestroyed } = dependencies(scene)
  const materializer = createDungeonWorldStateMaterializer(scene, deps)
  materializer.apply(state())

  const next = state()
  next.players = next.players.slice(0, 1)
  next.enemies = []
  next.drops = []
  next.projectiles = []
  next.scene.portal = null
  materializer.apply(next)

  assert.deepEqual(remoteDestroyed, ['guest'])
  assert.deepEqual(enemiesDestroyed, ['e1'])
  assert.equal(scene.drops.length, 0)
  assert.equal(scene.enemyProjectiles.length, 0)
  assert.equal(scene.portal, null)
})

test('resetTransient clears replay-only world entities without removing the local player', () => {
  const scene = sceneFixture()
  const { deps } = dependencies(scene)
  const materializer = createDungeonWorldStateMaterializer(scene, deps)
  materializer.apply(state())
  materializer.resetTransient()
  assert.deepEqual([...scene.players.keys()], ['host'])
  assert.equal(scene.enemies.length, 0)
  assert.equal(scene.drops.length, 0)
  assert.equal(scene.enemyProjectiles.length, 0)
})
