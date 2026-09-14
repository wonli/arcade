import test from 'node:test'
import assert from 'node:assert/strict'

import { weaponHudModel } from './presentation.js'

test('legendary weapon type resolves its specific localized identity', () => {
  const model = weaponHudModel({
    weapon: 'weapon.stormcrown',
    weaponRarity: 'legendary',
    weaponDamage: 42,
  }, 'zh-CN')
  assert.equal(model.name, '风暴王冠')
  assert.equal(model.archetypeLabel, '长剑')
})
