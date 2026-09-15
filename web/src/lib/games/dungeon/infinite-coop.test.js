import assert from 'node:assert/strict'
import test from 'node:test'

import { installInfiniteDungeon } from './infinite-runtime.js'

function sceneStub() {
  let spawnCount = 0
  let drawCount = 0
  const listeners = new Map()
  const scene = {
    floor: 1,
    floorCleared: false,
    floorKills: 0,
    dead: false,
    enemies: [],
    enemyProjectiles: [],
    playerState: { x: 100, y: 100, hp: 100, maxHp: 100, damage: 10, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } },
    player: { setPosition() {} },
    playerBar: {},
    time: { now: 1000, delayedCall(_delay, fn) { fn?.() } },
    events: {
      on(name, fn) { listeners.set(name, fn) },
      off(name) { listeners.delete(name) },
      once() {},
    },
    cameras: { main: { shake() {} } },
    add: {
      circle() { return { setStrokeStyle() { return this }, setDepth() { return this }, destroy() {}, setPosition() {} } },
      text() { return { setOrigin() { return this }, setDepth() { return this }, setText() { return this }, destroy() {}, setInteractive() { return this }, on() { return this } } },
    },
    tweens: { add() {} },
    input: { keyboard: { addKey() { return { on() {}, off() {} } } } },
    openPortal() {},
    spawnDrop() {},
    clearDrops() {},
    clearEnemies() { this.enemies = [] },
    clearEnemyProjectiles() { this.enemyProjectiles = [] },
    destroyPortal() { this.portal = null },
    drawArena() { drawCount++ },
    spawnEnemy() { spawnCount++; return null },
    showBanner() {},
    emitStats() {},
    updateHealthBar() {},
    __roomGeometry: { spawn: { x: 120, y: 120 }, rest: { x: 200, y: 200 } },
  }
  return { scene, get spawnCount() { return spawnCount }, get drawCount() { return drawCount } }
}

test('replica floor start renders normal floor lifecycle without spawning authoritative encounter', () => {
  const stub = sceneStub()
  const runtime = installInfiniteDungeon(stub.scene, {
    authority: false,
    initialProgress: { floor: 1, chapter: 1, chapterFloor: 1, chapterLength: 4, chapterPlan: ['combat', 'combat', 'combat', 'boss'], roomRole: 'combat' },
  })

  const applied = runtime.startFloorFromNetwork({
    floor: 2,
    chapter: 1,
    chapterFloor: 2,
    chapterLength: 4,
    chapterPlan: ['combat', 'combat', 'combat', 'boss'],
    roomRole: 'combat',
  })

  assert.equal(applied, true)
  assert.equal(stub.scene.floor, 2)
  assert.equal(stub.drawCount, 1)
  assert.equal(stub.spawnCount, 0)
})

test('replica cannot advance authoritative progression locally', () => {
  const stub = sceneStub()
  installInfiniteDungeon(stub.scene, {
    authority: false,
    initialProgress: { floor: 1, chapter: 1, chapterFloor: 1, chapterLength: 4, chapterPlan: ['combat', 'combat', 'combat', 'boss'], roomRole: 'combat' },
  })

  stub.scene.advanceFloor()
  assert.equal(stub.scene.floor, 1)
})
