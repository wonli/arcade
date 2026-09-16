import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonBacktracking, safeRestorePosition } from './backtrack-runtime.js'
import { prepareDropItem } from './pickup-runtime.js'
import { ensureDungeonPortalRuntime, installDungeonPortalSceneBridge } from './portal-runtime.js'
import { circleHitsSolid } from './spatial.js'
import { attachLegacyTestPlayer } from './test/player-fixture.js'

const backtrackSource = await readFile(new URL('./backtrack-runtime.js', import.meta.url), 'utf8')

function visual() {
  return {
    text: '',
    x: 0,
    y: 0,
    setDepth() { return this },
    setStrokeStyle() { return this },
    setOrigin() { return this },
    setVisible() { return this },
    setText(value) { this.text = String(value); return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    destroy() { this.destroyed = true },
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
    portal: { x: 800, y: 500, unlockAt: 0, glow: visual(), ring: visual(), core: visual() },
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
    destroyPortal() { this.portal?.countdownLabel?.destroy?.(); this.portal = null },
    clearEnemies() { this.enemies = [] },
    clearEnemyProjectiles() {},
    clearDrops() { this.drops = [] },
    spawnDrop(x, y, item) { this.drops.push({ x, y, item }) },
    openPortal() { this.portal = { x: this.__roomGeometry.exit.x, y: this.__roomGeometry.exit.y, unlockAt: 0, glow: visual(), ring: visual(), core: visual() } },
    drawArena() {},
    updateHealthBar() {},
    showBanner() {},
    updatePortal() {},
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
      this.portal = null
    },
  }
  return { scene, getInternalFloor: () => internalFloor, update: () => updateHandler?.() }
}

test('backtracking composes with the stable portal bridge instead of replacing Scene updatePortal', () => {
  const { scene } = makeScene()
  attachLegacyTestPlayer(scene)
  installDungeonPortalSceneBridge(scene)
  const updatePortal = scene.updatePortal

  installDungeonBacktracking(scene)

  assert.equal(scene.updatePortal, updatePortal)
  assert.doesNotMatch(backtrackSource, /scene\.updatePortal\s*=/)
})

test('backtracking forward dwell policy defers to an explicit portal update owner', () => {
  const { scene } = makeScene()
  installDungeonBacktracking(attachLegacyTestPlayer(scene))
  const portal = ensureDungeonPortalRuntime(scene)
  let ownerCalls = 0
  portal.setUpdateOwner(() => {
    ownerCalls++
    return 'owned'
  })

  const result = scene.updatePortal(1000, scene.localPlayer)

  assert.equal(result, 'owned')
  assert.equal(ownerCalls, 1)
  assert.equal(scene.portal.countdownLabel ?? null, null)
})

test('retreat restores previous cleared floor and its dropped equipment', () => {
  const { scene, getInternalFloor } = makeScene()
  const runtime = installDungeonBacktracking(attachLegacyTestPlayer(scene))
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
  const runtime = installDungeonBacktracking(attachLegacyTestPlayer(scene))
  scene.advanceFloor()
  runtime.retreat()
  scene.advanceFloor()
  assert.equal(scene.floor, 2)
  assert.equal(getInternalFloor(), 2)
  assert.equal(scene.__infiniteDungeon.getProgress().floor, 2)
})

test('back portal requires three continuous seconds and transitions without confirmation', () => {
  const { scene, update } = makeScene()
  installDungeonBacktracking(attachLegacyTestPlayer(scene))
  scene.advanceFloor()

  scene.time.now = 2000
  scene.localPlayer.state.x = 120
  scene.localPlayer.state.y = 184
  update()
  assert.equal(scene.floor, 2)

  scene.time.now = 3999
  update()
  assert.equal(scene.floor, 2)

  scene.time.now = 5000
  update()
  assert.equal(scene.floor, 1)
  assert.equal(scene.__infiniteDungeon.getProgress().floor, 1)
})

test('running through the back portal resets the countdown instead of changing floors', () => {
  const { scene, update } = makeScene()
  installDungeonBacktracking(attachLegacyTestPlayer(scene))
  scene.advanceFloor()

  scene.time.now = 2000
  scene.localPlayer.state.x = 120
  scene.localPlayer.state.y = 184
  update()

  scene.time.now = 3200
  scene.localPlayer.state.x = 220
  update()

  scene.time.now = 6000
  scene.localPlayer.state.x = 120
  update()
  assert.equal(scene.floor, 2)

  scene.time.now = 8999
  update()
  assert.equal(scene.floor, 2)

  scene.time.now = 9000
  update()
  assert.equal(scene.floor, 1)
})

test('forward portal uses the same three-second dwell behavior', () => {
  const { scene } = makeScene()
  installDungeonBacktracking(attachLegacyTestPlayer(scene))

  scene.time.now = 1000
  scene.updatePortal(1000)
  assert.equal(scene.floor, 1)
  assert.equal(scene.portal.countdownLabel.text, '3')

  scene.updatePortal(2500)
  assert.equal(scene.floor, 1)
  assert.equal(scene.portal.countdownLabel.text, '2')

  scene.localPlayer.state.x = 700
  scene.updatePortal(2800)
  assert.equal(scene.portal.countdownLabel, null)

  scene.localPlayer.state.x = 800
  scene.updatePortal(5000)
  assert.equal(scene.floor, 1)
  scene.updatePortal(8000)
  assert.equal(scene.floor, 2)
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
