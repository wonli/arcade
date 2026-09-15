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

test('authoritative targeted attack resolves attacker and target by stable ids', () => {
  const { scene, p2 } = sceneFixture()
  const target = { id: 'enemy-7', x: 80, y: 0, hp: 50 }
  scene.enemies = [target]
  let call = null
  scene.slash = (enemy, attacker) => { call = { enemy, attacker }; return 'slash-result' }

  const result = executePlayerCommand(scene, {
    type: 'attack',
    playerId: 'p2',
    targetId: 'enemy-7',
    time: 1200,
  })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, true)
  assert.equal(result.result, 'slash-result')
  assert.equal(call.enemy, target)
  assert.equal(call.attacker, p2)
})

test('authoritative untargeted attack routes through autoAttack with the resolved player', () => {
  const { scene, p2 } = sceneFixture()
  let call = null
  scene.autoAttack = (time, player) => { call = { time, player } }

  const result = executePlayerCommand(scene, { type: 'attack', playerId: 'p2', time: 1500 })

  assert.equal(result.accepted, true)
  assert.equal(result.applied, true)
  assert.deepEqual(call, { time: 1500, player: p2 })
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

test('commands reject unknown, dead, malformed players or targets without mutation', () => {
  const { scene, p2 } = sceneFixture()
  let calls = 0
  scene.slash = () => { calls++ }
  scene.autoAttack = () => { calls++ }

  assert.equal(executePlayerCommand(scene, { type: 'attack', playerId: 'missing' }).reason, 'player-not-found')
  p2.dead = true
  assert.equal(executePlayerCommand(scene, { type: 'attack', playerId: 'p2' }).reason, 'player-dead')
  p2.dead = false
  assert.equal(executePlayerCommand(scene, { type: 'attack', playerId: 'p2', targetId: 'missing' }).reason, 'target-not-found')
  assert.equal(executePlayerCommand(scene, { type: 'skill', playerId: 'p2' }).reason, 'skill-required')
  assert.equal(executePlayerCommand(scene, { type: 'pickup', playerId: 'p2' }).reason, 'drop-required')
  assert.equal(executePlayerCommand(scene, { type: 'unknown', playerId: 'p2' }).reason, 'unsupported-command')
  assert.equal(calls, 0)
})
