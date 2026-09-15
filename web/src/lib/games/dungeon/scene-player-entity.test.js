import test from 'node:test'
import assert from 'node:assert/strict'

import { PlayerEntity, createPlayerEntity } from './player-entity.js'
import { createDungeonGame } from './scene.js'

function phaserHarness() {
  class Scene {
    constructor(key) { this.sceneKey = key }
  }
  class Game {
    constructor(config) {
      this.config = config
      this.scene = new config.scene()
    }
  }
  return {
    Scene,
    Game,
    AUTO: 'AUTO',
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
  }
}

function otherPlayer(overrides = {}) {
  return createPlayerEntity({
    id: 'p2',
    state: {
      x: 100,
      y: 100,
      hp: 70,
      maxHp: 100,
      damage: 12,
      critChance: 0,
      critMultiplier: 2,
      effects: {},
      hasteUntil: 0,
      ...overrides,
    },
  })
}

test('single-player scene stores player state in one local PlayerEntity', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene

  assert.ok(scene.localPlayer instanceof PlayerEntity)
  assert.equal(scene.localPlayer.id, 'local')
  assert.equal(scene.localPlayer.state.hp, 100)
  assert.equal(scene.localPlayer.facing, 'down')
  assert.equal(scene.localPlayer.moving, false)
  assert.equal(scene.localPlayer.attacking, false)
  assert.equal(scene.localPlayer.lastAttackAt, 0)
  assert.equal(scene.localPlayer.skillReadyAt, 0)
  assert.equal(scene.localPlayer.lastContactAt, 0)
  assert.equal(scene.localPlayer.dead, false)
  assert.equal(scene.players.size, 1)
  assert.equal(scene.players.get(scene.localPlayer.id), scene.localPlayer)
})

test('single-player scene exposes no legacy player state aliases', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene
  const aliases = [
    'playerState',
    'player',
    'playerBar',
    'playerFacing',
    'playerMoving',
    'playerAttacking',
    'lastAttackAt',
    'skillReadyAt',
    'lastContactAt',
    'dead',
  ]

  for (const alias of aliases) assert.equal(Object.prototype.hasOwnProperty.call(scene, alias), false, alias)
})

test('hitPlayer only mutates the provided PlayerEntity', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene
  const local = scene.localPlayer
  const target = otherPlayer({ x: 20, y: 30 })
  target.bar = { id: 'target-bar' }
  scene.time = { now: 900 }
  scene.updateHealthBar = () => {}
  scene.flashPlayer = () => {}
  scene.emitStats = () => {}
  scene.gameOver = () => { target.dead = true }

  scene.hitPlayer(15, target)

  assert.equal(target.state.hp, 55)
  assert.equal(target.lastContactAt, 900)
  assert.equal(local.state.hp, 100)
  assert.equal(local.lastContactAt, 0)
})

test('autoAttack acquires targets from the provided PlayerEntity', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene
  const player = otherPlayer()
  const target = { id: 'enemy', x: 125, y: 100, hp: 20, maxHp: 20 }
  scene.enemies = [target]
  const slashes = []
  scene.slash = (enemy, attacker) => slashes.push({ enemy, attacker })

  scene.autoAttack(1000, player)

  assert.equal(player.lastAttackAt, 1000)
  assert.equal(scene.localPlayer.lastAttackAt, 0)
  assert.deepEqual(slashes, [{ enemy: target, attacker: player }])
})

test('healPlayer only heals the provided PlayerEntity', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene
  const player = otherPlayer({ hp: 45 })
  scene.updateHealthBar = () => {}
  scene.emitStats = () => {}

  scene.healPlayer(20, player)

  assert.equal(player.state.hp, 65)
  assert.equal(scene.localPlayer.state.hp, 100)
})

test('damageEnemy applies knockback away from the provided attacker', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene
  const attacker = otherPlayer({ x: 100, y: 100 })
  const enemy = { id: 'enemy', x: 120, y: 100, hp: 100, maxHp: 100, hitUntil: 0, boss: false, barOffset: 28 }
  scene.time = { now: 500 }
  scene.updateHealthBar = () => {}
  scene.damageText = () => {}
  scene.cameras = { main: { shake() {} } }

  scene.damageEnemy(enemy, 10, false, 20, { direct: true, canProc: false, source: 'weapon' }, attacker)

  assert.equal(enemy.hp, 90)
  assert.equal(enemy.x, 140)
  assert.equal(enemy.y, 100)
})
