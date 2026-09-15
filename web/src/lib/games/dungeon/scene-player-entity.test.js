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
  const target = createPlayerEntity({
    id: 'target',
    state: { x: 20, y: 30, hp: 70, maxHp: 100, effects: {} },
    bar: { id: 'target-bar' },
  })
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
