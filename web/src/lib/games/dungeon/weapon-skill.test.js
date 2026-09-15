import test from 'node:test'
import assert from 'node:assert/strict'

import { bowVolleyTargets, weaponGroupSkill } from './weapon-skill.js'

function player(archetype) {
  return {
    equipment: {
      weapon: { type: `weapon.test_${archetype}`, archetype, rarity: 'common', damage: 0, affixes: [] },
    },
  }
}

test('group skill follows weapon archetype instead of a shared whirlwind proc', () => {
  assert.equal(weaponGroupSkill(player('bow')), 'volley')
  assert.equal(weaponGroupSkill(player('staff')), 'arcane_nova')
  assert.equal(weaponGroupSkill(player('sword')), 'whirlwind')
  assert.equal(weaponGroupSkill(player('axe')), 'whirlwind')
})

test('bow volley selects the nearest two living secondary targets inside its cluster radius', () => {
  const primary = { id: 'primary', x: 100, y: 100, hp: 10 }
  const enemies = [
    primary,
    { id: 'near', x: 125, y: 100, hp: 10 },
    { id: 'mid', x: 150, y: 100, hp: 10 },
    { id: 'dead', x: 110, y: 100, hp: 0 },
    { id: 'far', x: 400, y: 100, hp: 10 },
  ]

  assert.deepEqual(bowVolleyTargets(primary, enemies, 80, 2).map((enemy) => enemy.id), ['near', 'mid'])
})
