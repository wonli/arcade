import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity, getPlayerSkillReadyAt } from './player-entity.js'
import { castPlayerSkill } from './player-skill-runtime.js'

function player(id, x = 100, y = 100) {
  return createPlayerEntity({
    id,
    state: {
      x,
      y,
      hp: 100,
      maxHp: 100,
      damage: 10,
      effects: {},
    },
  })
}

function sceneFixture() {
  const rings = []
  const hits = []
  return {
    enemies: [
      { id: 'near', x: 130, y: 100, hp: 20 },
      { id: 'far', x: 400, y: 100, hp: 20 },
    ],
    add: {
      circle(x, y, radius) {
        const ring = {
          x, y, radius,
          setStrokeStyle() { return this },
          destroy() { this.destroyed = true },
        }
        rings.push(ring)
        return ring
      },
    },
    tweens: { add() {} },
    cameras: { main: { shake() {} } },
    damageEnemy(enemy, damage, critical, knockback, context, attacker) {
      hits.push({ enemy, damage, critical, knockback, context, attacker })
    },
    __rings: rings,
    __hits: hits,
  }
}

test('skill casting is player-owned and damages only enemies in range', () => {
  const scene = sceneFixture()
  const caster = player('caster')

  const result = castPlayerSkill(scene, caster, 'primary', 1000)

  assert.equal(result.cast, true)
  assert.equal(result.hits, 1)
  assert.equal(scene.__hits.length, 1)
  assert.equal(scene.__hits[0].enemy.id, 'near')
  assert.equal(scene.__hits[0].attacker, caster)
  assert.equal(scene.__hits[0].context.source, 'skill')
  assert.equal(getPlayerSkillReadyAt(caster, 'primary'), 5200)
})

test('skill cooldowns remain isolated between players', () => {
  const scene = sceneFixture()
  const first = player('first')
  const second = player('second')

  assert.equal(castPlayerSkill(scene, first, 'primary', 1000).cast, true)
  assert.equal(castPlayerSkill(scene, first, 'primary', 2000).cast, false)
  assert.equal(castPlayerSkill(scene, second, 'primary', 2000).cast, true)

  assert.equal(getPlayerSkillReadyAt(first, 'primary'), 5200)
  assert.equal(getPlayerSkillReadyAt(second, 'primary'), 6200)
})
