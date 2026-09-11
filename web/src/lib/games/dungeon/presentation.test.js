import test from 'node:test'
import assert from 'node:assert/strict'

import { formatAffixLabel, weaponHudModel } from './presentation.js'

test('affix labels format percentages and flat values bilingually', () => {
  assert.equal(formatAffixLabel({ id: 'attack_speed', value: 0.14 }, 'zh-CN'), '+14% 攻速')
  assert.equal(formatAffixLabel({ id: 'attack_speed', value: 0.14 }, 'en'), '+14% Attack Speed')
  assert.equal(formatAffixLabel({ id: 'vitality', value: 24 }, 'zh-CN'), '+24 最大生命')
  assert.equal(formatAffixLabel({ id: 'critical_heal', value: 8 }, 'en'), '+8 HP on Crit')
})

test('build affixes receive a star and readable build names', () => {
  assert.equal(formatAffixLabel({ id: 'thunder', value: 0.42 }, 'zh-CN'), '★ 雷鸣 42%')
  assert.equal(formatAffixLabel({ id: 'executioner', value: 0.5 }, 'en'), '★ Executioner +50%')
})

test('weapon HUD model preserves base damage rarity and all equipped affixes', () => {
  const stats = {
    weapon: 'weapon.dungeon_blade',
    weaponRarity: 'epic',
    weaponDamage: 11,
    weaponAffixes: [
      { id: 'power', tier: 3, value: 0.22 },
      { id: 'life_steal', tier: 3, value: 0.08 },
      { id: 'berserker', tier: 3, value: 0.4 },
    ],
  }
  const model = weaponHudModel(stats, 'en')
  assert.equal(model.rarity, 'epic')
  assert.equal(model.damage, 11)
  assert.equal(model.affixes.length, 3)
  assert.ok(model.affixes[2].startsWith('★ Berserker'))
})
