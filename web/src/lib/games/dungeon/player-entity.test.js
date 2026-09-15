import test from 'node:test'
import assert from 'node:assert/strict'
import {
  attachLocalPlayerEntity,
  attachPlayerEntity,
  createPlayerEntity,
  getPlayerSkillReadyAt,
  startPlayerSkillCooldown,
} from './player-entity.js'

function baseState(x) {
  return {
    x,
    y: 200,
    hp: 100,
    maxHp: 100,
    damage: 10,
    speed: 190,
    critChance: 0.18,
    baseStats: { damage: 10, speed: 190, maxHp: 100 },
    weapon: null,
    weaponAffixes: [],
    effects: {},
  }
}

test('player entity keeps gameplay and presentation state together without scene globals', () => {
  const player = createPlayerEntity({ id: 'p1', state: baseState(100) })
  assert.equal(player.id, 'p1')
  assert.equal(player.state.x, 100)
  assert.equal(player.facing, 'down')
  assert.equal(player.moving, false)
  assert.equal(player.attacking, false)
  assert.equal(player.lastAttackAt, 0)
  assert.equal(player.skillReadyAt, 0)
  assert.equal(player.lastContactAt, 0)
  assert.equal(player.dead, false)
  assert.equal(player.actor, null)
  assert.equal(player.bar, null)
  assert.deepEqual(player.runtime, {})
})

test('two players never share mutable gameplay state', () => {
  const original = baseState(100)
  const p1 = createPlayerEntity({ id: 'p1', state: original })
  const p2 = createPlayerEntity({ id: 'p2', state: original })

  p1.state.x = 999
  p1.state.baseStats.damage = 77
  p1.state.weaponAffixes.push({ id: 'crit', value: 0.2 })
  p1.state.effects.poison = 1

  assert.equal(p2.state.x, 100)
  assert.equal(p2.state.baseStats.damage, 10)
  assert.deepEqual(p2.state.weaponAffixes, [])
  assert.deepEqual(p2.state.effects, {})
  assert.equal(original.x, 100)
  assert.equal(original.baseStats.damage, 10)
})

test('replacing gameplay state preserves the PlayerEntity state object identity', () => {
  const player = createPlayerEntity({ id: 'p1', state: baseState(100) })
  const reference = player.state

  player.state = { x: 300, y: 400, hp: 50 }

  assert.equal(player.state, reference)
  assert.deepEqual(player.state, { x: 300, y: 400, hp: 50 })
})

test('runtime combat timestamps and presentation refs are independent per player', () => {
  const p1 = createPlayerEntity({ id: 'p1', state: baseState(100) })
  const p2 = createPlayerEntity({ id: 'p2', state: baseState(200), facing: 'left' })

  p1.lastAttackAt = 1200
  p1.skillReadyAt = 5000
  p1.attacking = true
  p1.actor = { name: 'actor-1' }

  assert.equal(p2.lastAttackAt, 0)
  assert.equal(p2.skillReadyAt, 0)
  assert.equal(p2.attacking, false)
  assert.equal(p2.actor, null)
  assert.equal(p2.facing, 'left')
})

test('skill cooldowns are isolated by player and skill id while primary keeps legacy compatibility', () => {
  const p1 = createPlayerEntity({ id: 'p1', state: baseState(100) })
  const p2 = createPlayerEntity({ id: 'p2', state: baseState(200) })

  startPlayerSkillCooldown(p1, 'primary', 1000, 4200)
  startPlayerSkillCooldown(p1, 'dash', 1000, 1800)

  assert.equal(getPlayerSkillReadyAt(p1, 'primary'), 5200)
  assert.equal(getPlayerSkillReadyAt(p1, 'dash'), 2800)
  assert.equal(getPlayerSkillReadyAt(p2, 'primary'), 0)
  assert.equal(getPlayerSkillReadyAt(p2, 'dash'), 0)
  assert.equal(p1.skillReadyAt, 5200)

  p1.skillReadyAt = 6000
  assert.equal(getPlayerSkillReadyAt(p1, 'primary'), 6000)
  assert.equal(getPlayerSkillReadyAt(p1, 'dash'), 2800)
})

test('gameplay runtime namespaces are owned by each player', () => {
  const p1 = createPlayerEntity({ id: 'p1', state: baseState(100) })
  const p2 = createPlayerEntity({ id: 'p2', state: baseState(200) })

  p1.runtime.weapon = { visual: { id: 'p1-weapon' } }
  p1.runtime.inventory = { selectedDrop: 'drop-1' }

  assert.equal(p1.runtime.weapon.visual.id, 'p1-weapon')
  assert.equal(p1.runtime.inventory.selectedDrop, 'drop-1')
  assert.deepEqual(p2.runtime, {})
})

test('scene player registry can hold multiple independent entities while the single-player pointer stays unchanged', () => {
  const scene = {}
  const first = attachLocalPlayerEntity(scene, { id: 'p1', state: baseState(100) })
  const second = attachPlayerEntity(scene, { id: 'p2', state: baseState(200) })

  assert.equal(scene.localPlayer, first)
  assert.equal(scene.players.size, 2)
  assert.equal(scene.players.get('p1'), first)
  assert.equal(scene.players.get('p2'), second)
  assert.notEqual(first.state, second.state)
})

test('scene player registry rejects duplicate ids', () => {
  const scene = {}
  attachPlayerEntity(scene, { id: 'p1', state: baseState(100) })
  assert.throws(
    () => attachPlayerEntity(scene, { id: 'p1', state: baseState(200) }),
    /already attached/i,
  )
})

test('player id is mandatory', () => {
  assert.throws(() => createPlayerEntity({ state: baseState(100) }), /player id/i)
})
