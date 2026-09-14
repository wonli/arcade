import test from 'node:test'
import assert from 'node:assert/strict'

import { groundWeaponLabel } from './pickup-runtime.js'

test('ground weapon label makes archetype and specific weapon obvious', () => {
  const item = {
    type: 'weapon.tempest_bow',
    name: 'Tempest Bow',
    archetype: 'bow',
    rarity: 'epic',
    damage: 18,
    affixes: [],
  }
  assert.equal(groundWeaponLabel(item, 'zh-CN'), '弓 · 风暴弓')
  assert.equal(groundWeaponLabel(item, 'en'), 'Bow · Tempest Bow')
})
