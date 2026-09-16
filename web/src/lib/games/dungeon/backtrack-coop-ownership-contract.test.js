import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonBacktracking } from './backtrack-runtime.js'
import { attachLegacyTestPlayer } from './test/player-fixture.js'

function visual() {
  return {
    setDepth() { return this },
    setStrokeStyle() { return this },
    setOrigin() { return this },
    setVisible() { return this },
    setText() { return this },
    setPosition() { return this },
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
    floorKills: 0,
    enemies: [],
    drops: [],
    portal: { x: 800, y: 500, unlockAt: 0, glow: visual(), ring: visual(), core: visual() },
    time: { now: 1000 },
    __roomGeometry: geometries[1],
    __dungeonSpatial: {
      getGeometry: () => scene.__roomGeometry,
      getChests: () => [],
      refreshRoom({ geometry }) { scene.__roomGeometry = geometry },
    },
    __infiniteDungeon: {
      getProgress: () => ({ floor: internalFloor, chapter: 1, chapterFloor: internalFloor, chapterLength: 4, chapterPlan: ['combat', 'combat', 'combat', 'boss'], roomRole: 'combat', fortuneActive: false }),
    },
    add: { circle: () => visual(), text: () => visual() },
    tweens: { add() {} },
    events: {
      on(name, fn) { if (name === 'update') updateHandler = fn },
      off() {},
      once() {},
    },
    destroyPortal() { this.portal = null },
    clearEnemies() { this.enemies = [] },
    clearEnemyProjectiles() {},
    clearDrops() { this.drops = [] },
    spawnDrop() {},
    openPortal() { this.portal = { x: this.__roomGeometry.exit.x, y: this.__roomGeometry.exit.y, unlockAt: 0, glow: visual(), ring: visual(), core: visual() } },
    drawArena() {},
    updateHealthBar() {},
    showBanner() {},
    updatePortal() {},
    startFloor() {},
    advanceFloor() {
      internalFloor++
      this.floor = internalFloor
      this.floorCleared = false
      this.floorKills = 0
      this.enemies = [{ hp: 20, maxHp: 20 }]
      this.drops = []
      this.__roomGeometry = geometries[internalFloor]
      this.portal = null
      return this.floor
    },
  }
  attachLegacyTestPlayer(scene)
  return { scene, update: () => updateHandler?.() }
}

test('co-op can own back-portal dwell without follower-local retreat', () => {
  const { scene, update } = makeScene()
  const backtrack = installDungeonBacktracking(scene)

  assert.equal(typeof backtrack.setUpdateOwner, 'function')

  let ownerCalls = 0
  backtrack.setUpdateOwner(({ portal, time, retreat }) => {
    ownerCalls++
    assert.ok(portal)
    assert.equal(time, scene.time.now)
    assert.equal(typeof retreat, 'function')
    return { handled: true }
  })

  scene.advanceFloor()
  scene.localPlayer.state.x = 120
  scene.localPlayer.state.y = 184
  scene.time.now = 5000
  update()

  assert.equal(ownerCalls, 1)
  assert.equal(scene.floor, 2)
})
