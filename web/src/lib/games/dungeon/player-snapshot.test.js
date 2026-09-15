import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'

function state(x = 100) {
  return {
    x,
    y: 200,
    hp: 75,
    maxHp: 100,
    damage: 12,
    equipment: {
      weapon: {
        type: 'weapon.test',
        archetype: 'sword',
        rarity: 'rare',
        damage: 8,
        affixes: [{ id: 'crit', value: 0.2 }],
      },
    },
    modifiers: { equipment: { attackSpeed: 0.2 } },
  }
}

test('player snapshot contains only serializable network state', () => {
  const player = createPlayerEntity({ id: 'p2', state: state(), facing: 'left' })
  player.moving = true
  player.attacking = true
  player.dead = false
  player.lastAttackAt = 1200
  player.lastContactAt = 900
  player.runtime.skills = { cooldowns: { primary: 5000, dash: 2800 } }
  player.runtime.weaponVisuals = { sync() {} }
  player.runtime.weaponProjectiles = { projectiles: new Set([{ id: 'projectile' }]) }
  player.actor = { destroy() {} }
  player.bar = { destroy() {} }

  const snapshot = serializePlayerSnapshot(player)

  assert.deepEqual(snapshot, {
    id: 'p2',
    state: state(),
    facing: 'left',
    moving: true,
    attacking: true,
    dead: false,
    lastAttackAt: 1200,
    lastContactAt: 900,
    skillCooldowns: { primary: 5000, dash: 2800 },
  })
  assert.equal(JSON.parse(JSON.stringify(snapshot)).id, 'p2')
  assert.equal('actor' in snapshot, false)
  assert.equal('bar' in snapshot, false)
  assert.equal('runtime' in snapshot, false)
})

test('player snapshot owns a deep copy of gameplay state and cooldowns', () => {
  const player = createPlayerEntity({ id: 'p2', state: state() })
  player.runtime.skills = { cooldowns: { primary: 5000 } }

  const snapshot = serializePlayerSnapshot(player)
  snapshot.state.equipment.weapon.affixes.push({ id: 'poison', value: 1 })
  snapshot.skillCooldowns.primary = 1

  assert.deepEqual(player.state.equipment.weapon.affixes, [{ id: 'crit', value: 0.2 }])
  assert.equal(player.runtime.skills.cooldowns.primary, 5000)
})

test('applying a snapshot preserves PlayerEntity state identity and local runtime objects', () => {
  const player = createPlayerEntity({ id: 'p2', state: state(10), facing: 'down' })
  const stateReference = player.state
  const weaponVisuals = { sync() {} }
  player.runtime.weaponVisuals = weaponVisuals
  player.runtime.skills = { cooldowns: { primary: 100 } }

  const snapshot = {
    id: 'p2',
    state: { ...state(320), hp: 40 },
    facing: 'up',
    moving: true,
    attacking: false,
    dead: false,
    lastAttackAt: 1500,
    lastContactAt: 1400,
    skillCooldowns: { primary: 6200, dash: 3300 },
  }

  const result = applyPlayerSnapshot(player, snapshot)

  assert.equal(result, player)
  assert.equal(player.state, stateReference)
  assert.equal(player.state.x, 320)
  assert.equal(player.state.hp, 40)
  assert.equal(player.facing, 'up')
  assert.equal(player.moving, true)
  assert.equal(player.lastAttackAt, 1500)
  assert.equal(player.lastContactAt, 1400)
  assert.deepEqual(player.runtime.skills.cooldowns, { primary: 6200, dash: 3300 })
  assert.equal(player.runtime.weaponVisuals, weaponVisuals)
})

test('applying a snapshot rejects an id mismatch', () => {
  const player = createPlayerEntity({ id: 'p2', state: state() })

  assert.throws(
    () => applyPlayerSnapshot(player, { id: 'p3', state: state() }),
    /snapshot id/i,
  )
})
