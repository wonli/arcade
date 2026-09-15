import test from 'node:test'
import assert from 'node:assert/strict'

import { attackInterval, healFromHit, modifiedDamage, skillProfile } from './combat.js'
import {
  attachLocalPlayerEntity,
  attachPlayerEntity,
  createPlayerEntity,
  detachPlayerEntity,
} from './player-entity.js'
import { castPlayerSkill, playerSkillHandler } from './player-skill-runtime.js'
import { nearestLivingPlayer } from './player-targeting.js'

function state(x = 0, y = 0) {
  return {
    x,
    y,
    hp: 20,
    maxHp: 100,
    damage: 10,
    critChance: 0,
    effects: {
      attackSpeed: 0,
      skillRadius: 0,
      skillHaste: 0,
      lifeSteal: 0,
      lowHealthDamage: 0,
    },
    modifiers: {
      equipment: {
        attackSpeed: 0.5,
        skillRadius: 0.5,
        skillHaste: 0.5,
        lifeSteal: 0.25,
        lowHealthDamage: 0.5,
      },
    },
  }
}

test('combat reads canonical modifier layers instead of stale effects mirrors', () => {
  const player = state()

  assert.equal(modifiedDamage(player, { hp: 100, maxHp: 100 }, 10), 15)
  assert.equal(attackInterval(player, 0), 287)
  assert.deepEqual(skillProfile(player), { radius: 195, cooldown: 2100 })
  assert.equal(healFromHit(player, 20, false), 5)
})

test('skill dispatch is handler-based and unsupported skill ids do not start cooldowns', () => {
  const player = createPlayerEntity({ id: 'p1', state: state() })
  const scene = { enemies: [] }

  assert.equal(typeof playerSkillHandler('primary'), 'function')
  assert.equal(playerSkillHandler('missing'), null)
  assert.deepEqual(castPlayerSkill(scene, player, 'missing', 1000), {
    cast: false,
    hits: 0,
    skillId: 'missing',
  })
  assert.equal(player.runtime.skills, undefined)
})

test('player registry supports detaching remote and local entities explicitly', () => {
  const scene = {}
  const local = attachLocalPlayerEntity(scene, { id: 'local', state: state(0, 0) })
  const remote = attachPlayerEntity(scene, { id: 'remote', state: state(40, 0) })

  assert.equal(detachPlayerEntity(scene, remote), remote)
  assert.equal(scene.players.has('remote'), false)
  assert.equal(scene.localPlayer, local)
  assert.equal(detachPlayerEntity(scene, 'local'), local)
  assert.equal(scene.players.has('local'), false)
  assert.equal(scene.localPlayer, null)
  assert.equal(detachPlayerEntity(scene, 'missing'), null)
})

test('world targeting chooses the nearest living registered player', () => {
  const scene = {}
  const local = attachLocalPlayerEntity(scene, { id: 'local', state: state(0, 0) })
  const remote = attachPlayerEntity(scene, { id: 'remote', state: state(80, 0) })

  assert.equal(nearestLivingPlayer(scene, { x: 70, y: 0 }), remote)
  remote.dead = true
  assert.equal(nearestLivingPlayer(scene, { x: 70, y: 0 }), local)
  local.state.hp = 0
  assert.equal(nearestLivingPlayer(scene, { x: 70, y: 0 }), null)
})
