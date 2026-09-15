import test from 'node:test'
import assert from 'node:assert/strict'

import { PlayerEntity } from './player-entity.js'
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
  const game = createDungeonGame({ Phaser, parent: null })
  const scene = game.scene

  assert.ok(scene.localPlayer instanceof PlayerEntity)
  assert.equal(scene.localPlayer.id, 'local')
  assert.equal(scene.playerState, scene.localPlayer.state)
  assert.equal(scene.player, scene.localPlayer.actor)
  assert.equal(scene.playerBar, scene.localPlayer.bar)
  assert.equal(scene.playerFacing, scene.localPlayer.facing)
  assert.equal(scene.playerMoving, scene.localPlayer.moving)
  assert.equal(scene.playerAttacking, scene.localPlayer.attacking)
  assert.equal(scene.lastAttackAt, scene.localPlayer.lastAttackAt)
  assert.equal(scene.skillReadyAt, scene.localPlayer.skillReadyAt)
  assert.equal(scene.lastContactAt, scene.localPlayer.lastContactAt)
  assert.equal(scene.dead, scene.localPlayer.dead)
})

test('legacy scene player aliases and PlayerEntity stay bidirectionally synchronized', () => {
  const Phaser = phaserHarness()
  const scene = createDungeonGame({ Phaser, parent: null }).scene

  scene.playerFacing = 'left'
  scene.playerMoving = true
  scene.lastAttackAt = 1234
  scene.playerState = { ...scene.playerState, hp: 42 }
  const actor = { id: 'actor' }
  scene.player = actor

  assert.equal(scene.localPlayer.facing, 'left')
  assert.equal(scene.localPlayer.moving, true)
  assert.equal(scene.localPlayer.lastAttackAt, 1234)
  assert.equal(scene.localPlayer.state.hp, 42)
  assert.equal(scene.localPlayer.actor, actor)

  scene.localPlayer.attacking = true
  scene.localPlayer.skillReadyAt = 9876
  scene.localPlayer.dead = true

  assert.equal(scene.playerAttacking, true)
  assert.equal(scene.skillReadyAt, 9876)
  assert.equal(scene.dead, true)
})
