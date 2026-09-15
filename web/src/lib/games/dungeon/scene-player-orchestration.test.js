import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { createDungeonGame } from './scene.js'

const Phaser = {
  AUTO: 'AUTO',
  Scene: class {},
  Game: class {
    constructor(config) {
      return new config.scene()
    }
  },
  Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
  Math: {
    Clamp(value, min, max) {
      return Math.max(min, Math.min(max, value))
    },
    RadToDeg(value) {
      return value * 180 / Math.PI
    },
  },
  Input: { Keyboard: { JustDown: () => false } },
}

function sceneFixture(options = {}) {
  return createDungeonGame({ Phaser, ...options })
}

function player(id, x = 100, y = 100) {
  return createPlayerEntity({
    id,
    state: {
      x,
      y,
      hp: 20,
      maxHp: 100,
      healthPotions: 0,
      damage: 10,
      speed: 190,
      critChance: 0.18,
      baseStats: { damage: 10, speed: 190, critChance: 0.18, maxHp: 100 },
      effects: {},
    },
  })
}

test('scene update routes the local PlayerEntity through player-sensitive systems', () => {
  const scene = sceneFixture()
  const calls = []
  scene.updatePlayer = (dt, target) => calls.push(['player', target])
  scene.updateEnemies = (time, dt, target) => calls.push(['enemies', target])
  scene.updateEnemyProjectiles = (dt, target) => calls.push(['projectiles', target])
  scene.updateDrops = (target) => calls.push(['drops', target])
  scene.updatePortal = (time, target) => calls.push(['portal', target])
  scene.autoAttack = (time, target) => calls.push(['attack', target])
  scene.trySkill = (time, target) => calls.push(['skill', target])

  scene.update(1000, 16)

  assert.deepEqual(calls.map(([name]) => name), ['player', 'enemies', 'projectiles', 'drops', 'portal', 'attack', 'skill'])
  for (const [, target] of calls) assert.equal(target, scene.localPlayer)
})

test('potion pickup mutates only the provided PlayerEntity inventory', () => {
  const scene = sceneFixture()
  const local = scene.localPlayer
  const target = player('target', 100, 100)
  local.state.x = 500
  local.state.y = 500
  local.state.hp = 20
  local.state.maxHp = 100
  local.state.healthPotions = 0
  scene.drops = [{ x: 100, y: 100, item: { type: 'consumable.health_potion', heal: 28 } }]
  scene.destroyDrop = () => {}
  scene.pickupBurst = () => {}
  scene.updateHealthBar = () => {}
  let stats = 0
  scene.emitStats = () => { stats++ }

  scene.updateDrops(target)

  assert.equal(target.state.hp, 20)
  assert.equal(target.state.healthPotions, 1)
  assert.equal(local.state.hp, 20)
  assert.equal(local.state.healthPotions, 0)
  assert.equal(scene.drops.length, 0)
  assert.equal(stats, 0)
})

test('floor clear forwards the provided PlayerEntity to the portal callback', () => {
  const scene = sceneFixture()
  const target = player('target')
  scene.localPlayer.dead = true
  scene.enemies = []
  scene.floor = 1
  scene.floorCleared = false
  scene.runComplete = false
  scene.showBanner = () => {}
  let delayed = null
  scene.time = { delayedCall: (delay, callback) => { delayed = { delay, callback } } }
  let portalPlayer = null
  scene.openPortal = (provided) => { portalPlayer = provided }

  scene.checkFloorClear(target)

  assert.equal(scene.floorCleared, true)
  assert.equal(delayed?.delay, 750)
  delayed.callback()
  assert.equal(portalPlayer, target)
})

test('portal open and traversal use the provided PlayerEntity', () => {
  const scene = sceneFixture()
  const target = player('target', 222, 333)
  scene.localPlayer.dead = true
  scene.__roomGeometry = { exit: { x: 222, y: 333 } }
  scene.time = { now: 100 }
  const visual = () => ({
    setDepth() { return this },
    setStrokeStyle() { return this },
  })
  scene.add = { circle: visual }
  scene.tweens = { add: () => {} }

  scene.openPortal(target)
  assert.ok(scene.portal)

  scene.localPlayer.state.x = 800
  scene.localPlayer.state.y = 500
  scene.portal.unlockAt = 0
  let advanced = null
  scene.advanceFloor = (provided) => { advanced = provided }
  scene.updatePortal(200, target)
  assert.equal(advanced, target)
})

test('advancing a floor carries the provided PlayerEntity into the next floor', () => {
  const scene = sceneFixture()
  const target = player('target')
  scene.localPlayer.dead = true
  scene.floor = 1
  scene.runComplete = false
  scene.time = { now: 321 }
  scene.destroyPortal = () => {}
  let nextFloor = null
  scene.startFloor = (initial, provided) => { nextFloor = { initial, provided } }

  scene.advanceFloor(target)

  assert.equal(scene.floor, 2)
  assert.equal(target.lastContactAt, 321)
  assert.equal(scene.localPlayer.lastContactAt, 0)
  assert.deepEqual(nextFloor, { initial: false, provided: target })
})

test('run completion checks the provided PlayerEntity instead of local player state', () => {
  const scene = sceneFixture()
  const target = player('target')
  scene.localPlayer.dead = true
  scene.runComplete = false
  scene.destroyPortal = () => {}
  scene.clearEnemyProjectiles = () => {}
  scene.ambient = { stop: () => {} }
  const visual = () => ({
    setDepth() { return this },
    setOrigin() { return this },
  })
  scene.add = { rectangle: visual, text: visual }
  scene.emitStats = () => {}

  scene.completeRun(target)

  assert.equal(scene.runComplete, true)
})
