import test from 'node:test'
import assert from 'node:assert/strict'

import { attachPlayerEntity } from './player-entity.js'
import { executePlayerCommand } from './player-command-runtime.js'

function playerState(x = 0) {
  return {
    x,
    y: 0,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture() {
  const scene = { players: new Map(), enemies: [] }
  const p1 = attachPlayerEntity(scene, { id: 'p1', state: playerState(0) })
  const p2 = attachPlayerEntity(scene, { id: 'p2', state: playerState(40) })
  return { scene, p1, p2 }
}

test('attack command never bypasses host autoAttack even when target and sender-time hints are supplied', () => {
  const { scene, p2 } = sceneFixture()
  scene.time = { now: 1200 }
  scene.enemies = [{ id: 'enemy-7', x: 80, y: 0, hp: 50 }]
  let slashCalls = 0
  let autoAttackCall = null
  scene.slash = () => { slashCalls++ }
  scene.autoAttack = (time, player) => {
    autoAttackCall = { time, player }
    player.lastAttackAt = time
  }

  const result = executePlayerCommand(scene, {
    type: 'attack',
    playerId: 'p2',
    targetId: 'enemy-7',
    time: 999999,
  })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, true)
  assert.equal(slashCalls, 0)
  assert.deepEqual(autoAttackCall, { time: 1200, player: p2 })
})

test('attack command reports non-applied when host autoAttack declines the intent', () => {
  const { scene, p2 } = sceneFixture()
  scene.autoAttack = () => {}

  const result = executePlayerCommand(scene, { type: 'attack', playerId: 'p2', time: 1500 })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, false)
  assert.equal(result.reason, 'attack-not-applied')
  assert.equal(p2.lastAttackAt, 0)
})

test('non-authoritative command validates intent without mutating gameplay', () => {
  const { scene } = sceneFixture()
  let attacks = 0
  scene.autoAttack = () => { attacks++ }

  const result = executePlayerCommand(
    scene,
    { type: 'attack', playerId: 'p2', time: 1500 },
    { authoritative: false },
  )

  assert.equal(result.accepted, true)
  assert.equal(result.applied, false)
  assert.equal(result.reason, 'intent-only')
  assert.equal(attacks, 0)
})

test('skill command owns cooldown and damage through the resolved player', () => {
  const { scene, p2 } = sceneFixture()
  scene.time = { now: 1000 }
  scene.enemies = []

  const result = executePlayerCommand(scene, {
    type: 'skill',
    playerId: 'p2',
    skillId: 'primary',
    time: 1000,
  })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, true)
  assert.equal(result.result.cast, true)
  assert.ok(p2.skillReadyAt > 1000)
})

test('pickup command delegates only to an explicit stable-id pickup API', () => {
  const { scene, p2 } = sceneFixture()
  let call = null
  scene.__dungeonPickupRuntime = {
    pickupById(player, dropId) {
      call = { player, dropId }
      return { picked: true, dropId }
    },
  }

  const result = executePlayerCommand(scene, {
    type: 'pickup',
    playerId: 'p2',
    dropId: 'drop-9',
  })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, true)
  assert.deepEqual(call, { player: p2, dropId: 'drop-9' })
})

test('pickup stays non-applied until the world exposes stable drop identity', () => {
  const { scene } = sceneFixture()

  const result = executePlayerCommand(scene, {
    type: 'pickup',
    playerId: 'p2',
    dropId: 'drop-9',
  })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, false)
  assert.equal(result.reason, 'pickup-unavailable')
})

test('open_chest delegates to authority-owned stable chest identity', () => {
  const { scene, p2 } = sceneFixture()
  let call = null
  scene.__dungeonSpatial = {
    openChestById(player, chestId) {
      call = { player, chestId }
      return { opened: true, chestId }
    },
  }

  const result = executePlayerCommand(scene, {
    type: 'open_chest',
    playerId: 'p2',
    chestId: 'chest:7:0',
  })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, true)
  assert.deepEqual(call, { player: p2, chestId: 'chest:7:0' })
})

test('open_chest rejects missing identity and remains non-applied without spatial authority', () => {
  const { scene } = sceneFixture()

  assert.equal(executePlayerCommand(scene, { type: 'open_chest', playerId: 'p2' }).reason, 'chest-required')
  const result = executePlayerCommand(scene, { type: 'open_chest', playerId: 'p2', chestId: 'chest:7:0' })
  assert.equal(result.accepted, true)
  assert.equal(result.applied, false)
  assert.equal(result.reason, 'chest-unavailable')
})

test('commands reject unknown, dead, or malformed players without mutation', () => {
  const { scene, p2 } = sceneFixture()
  let calls = 0
  scene.autoAttack = () => { calls++ }

  assert.equal(executePlayerCommand(scene, { type: 'attack', playerId: 'missing' }).reason, 'player-not-found')
  p2.dead = true
  assert.equal(executePlayerCommand(scene, { type: 'attack', playerId: 'p2' }).reason, 'player-dead')
  p2.dead = false
  assert.equal(executePlayerCommand(scene, { type: 'skill', playerId: 'p2' }).reason, 'skill-required')
  assert.equal(executePlayerCommand(scene, { type: 'pickup', playerId: 'p2' }).reason, 'drop-required')
  assert.equal(executePlayerCommand(scene, { type: 'open_chest', playerId: 'p2' }).reason, 'chest-required')
  assert.equal(executePlayerCommand(scene, { type: 'unknown', playerId: 'p2' }).reason, 'unsupported-command')
  assert.equal(calls, 0)
})
