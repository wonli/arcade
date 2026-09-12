import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonBacktracking, safeRestorePosition } from './backtrack-runtime.js'
import { prepareDropItem } from './pickup-runtime.js'
import { circleHitsSolid } from './spatial.js'

function visual() {
  return {
    setDepth() { return this },
    setStrokeStyle() { return this },
    setOrigin() { return this },
    setVisible() { return this },
    destroy() {},
  }
}

function makeScene() {
  let internalFloor = 1
  let updateHandler = null
  const geometries = {
    1: { width: 960, height: 600, spawn: { x: 100, y: 100 }, exit: { x: 800, y: 500 } },
    2: { width: 960, height: 600, spawn: { x: 120, y: 110 }, exit: { x: 810, y: 500 } },
  }
  const scene = {
    floor: 1,
    floorCleared: true,
    floorKills: 3,
    playerState: { x: 800, y: 500, hp: 100, maxHp: 100 },
    player: { setPosition() {} },
    playerBar: {},
    enemies: [],
    drops: [{ x: 300, y: 300, item: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 31, affixes: [] } }],
    portal: { live: true },
    time: { now: 1000 },
    __roomGeometry: geometries[1],
    __dungeonSpatial: {
      getGeometry: () => scene.__roomGeometry,
      getChests: () => [],
      refreshRoom({ geometry }) { scene.__roomGeometry = geometry },
    },
    __infiniteDungeon: { getProgress: () => ({ floor: internalFloor, chapter: 1, roomRole: 'combat', fortuneActive: false }) },
    add: { circle: () => visual(), text: () => visual() },
    tweens: { add() {} },
    events: { on(_name, fn) { updateHandler = fn }, off() {}, once() {} },
    destroyPortal() { this.portal = null },
    clearEnemies() { this.enemies = [] },
    clearEnemyProjectiles() {},
    clearDrops() { this.drops = [] },
    spawnDrop(x, y, item) { this.drops.push({ x, y, item }) },
    openPortal() { this.portal = { live: true } },
    drawArena() {},
    updateHealthBar() {},
    showBanner() {},
    startFloor() {
      this.floorCleared = false
      this.floorKills = 0
      this.enemies = [{ hp: 20, maxHp: 20 }]
      this.__roomGeometry = geometries[internalFloor]
    },
    advanceFloor() {
      internalFloor++
      this.floor = internalFloor
      this.floorCleared = false
      this.floorKills = 0
      this.enemies = [{ hp: 20, maxHp: 20 }]
      this.drops = []
      this.__roomGeometry = geometries[internalFloor]
    },
  }
  return { scene, getInternalFloor: () => internalFloor, update: () => updateHandler?.() }
}

test('retreat restores previous cleared floor and its dropped equipment', () => {
  const { scene, getInternalFloor } = makeScene()
  const runtime = installDungeonBacktracking(scene)
  scene.advanceFloor()
  assert.equal(scene.floor, 2)
  assert.equal(getInternalFloor(), 2)
  assert.equal(runtime.retreat(), true)
  assert.equal(scene.floor, 1)
  assert.equal(scene.__infiniteDungeon.getProgress().floor, 1)
  assert.equal(scene.drops.length, 1)
  assert.equal(scene.drops[0].item.damage, 31)
})

test('forward portal from backtracked floor returns to cached deeper floor without advancing twice', () => {
  const { scene, getInternalFloor } = makeScene()
  const runtime = installDungeonBacktracking(scene)
  scene.advanceFloor()
  runtime.retreat()
  scene.advanceFloor()
  assert.equal(scene.floor, 2)
  assert.equal(getInternalFloor(), 2)
  assert.equal(scene.__infiniteDungeon.getProgress().floor, 2)
})

test('back portal asks for confirmation before returning to the previous floor', () => {
  const { scene, update } = makeScene()
  let prompts = 0
  const runtime = installDungeonBacktracking(scene, {
    confirmRetreat() {
      prompts++
      return false
    },
  })

  scene.advanceFloor()
  scene.time.now = 2000
  scene.playerState.x = 120
  scene.playerState.y = 184
  update()

  assert.equal(prompts, 1)
  assert.equal(scene.floor, 2)
  assert.equal(runtime.getVisibleProgress().floor, 2)
})

test('cancelled backtrack confirmation stays dismissed until the player leaves the portal', () => {
  const { scene, update } = makeScene()
  let prompts = 0
  installDungeonBacktracking(scene, {
    confirmRetreat() {
      prompts++
      return false
    },
  })

  scene.advanceFloor()
  scene.time.now = 2000
  scene.playerState.x = 120
  scene.playerState.y = 184
  update()
  update()
  assert.equal(prompts, 1)

  scene.playerState.x = 220
  scene.playerState.y = 184
  update()

  scene.playerState.x = 120
  scene.playerState.y = 184
  update()
  assert.equal(prompts, 2)
})

test('confirming the backtrack prompt returns to the previous floor', () => {
  const { scene, update } = makeScene()
  let prompts = 0
  installDungeonBacktracking(scene, {
    confirmRetreat() {
      prompts++
      return true
    },
  })

  scene.advanceFloor()
  scene.time.now = 2000
  scene.playerState.x = 120
  scene.playerState.y = 184
  update()

  assert.equal(prompts, 1)
  assert.equal(scene.floor, 1)
  assert.equal(scene.__infiniteDungeon.getProgress().floor, 1)
})

test('restored drops bypass rerolling so old equipment keeps its exact damage', () => {
  const item = { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 31, affixes: [] }
  const scene = { __restoringFloor: true, floor: 30, __dungeonSpatial: { getChests: () => [] } }
  assert.equal(prepareDropItem(scene, 0, 0, item, () => 0.99).damage, 31)
})

test('backtracking chooses a collision-free point near the exit instead of a fixed offset', () => {
  const geometry = {
    width: 960,
    height: 600,
    spawn: { x: 100, y: 100 },
    exit: { x: 800, y: 500 },
    rooms: [{ x: 700, y: 360, width: 180, height: 170, center: { x: 790, y: 445 } }],
    solids: [{ x: 770, y: 395, width: 60, height: 60 }],
    water: [],
    spawnPoints: [{ x: 790, y: 470 }],
  }
  const position = safeRestorePosition(geometry, 'back')
  assert.equal(circleHitsSolid(position, 18, geometry), false)
  assert.ok(Math.hypot(position.x - geometry.exit.x, position.y - geometry.exit.y) >= 44)
})
