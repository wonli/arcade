import test from 'node:test'
import assert from 'node:assert/strict'

import { combatVisualCue, formatAffixLabel, weaponComparisonModel, weaponHudModel } from './presentation.js'

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

test('weapon comparison keeps ground weapon pending and marks comparable gains and losses', () => {
  const current = { rarity: 'rare', damage: 8, affixes: [{ id: 'attack_speed', tier: 2, value: 0.14 }, { id: 'life_steal', tier: 1, value: 0.04 }] }
  const candidate = { rarity: 'epic', damage: 11, affixes: [{ id: 'attack_speed', tier: 3, value: 0.18 }, { id: 'thunder', tier: 2, value: 0.42 }] }
  const model = weaponComparisonModel(current, candidate, 'en')
  assert.equal(model.current.damage, 8)
  assert.equal(model.candidate.damage, 11)
  assert.equal(model.candidate.damageDelta, 3)
  assert.equal(model.candidate.affixes.find((entry) => entry.id === 'attack_speed').direction, 'up')
  assert.equal(model.current.affixes.find((entry) => entry.id === 'life_steal').direction, 'lost')
  assert.equal(model.candidate.affixes.find((entry) => entry.id === 'thunder').build, true)
})

test('weapon comparison supports the first weapon in a run', () => {
  const model = weaponComparisonModel(null, { rarity: 'uncommon', damage: 4, affixes: [{ id: 'power', tier: 1, value: 0.08 }] }, 'zh-CN')
  assert.equal(model.current, null)
  assert.equal(model.candidate.damageDelta, 4)
  assert.equal(model.candidate.affixes[0].direction, 'new')
})

test('combat visual cues map combat outcomes to distinct presentation effects', () => {
  assert.deepEqual(combatVisualCue('thunder'), { kind: 'chain-lightning', color: 0x8fdcff, width: 4, duration: 150 })
  assert.deepEqual(combatVisualCue('whirlwind'), { kind: 'radial-slash', color: 0xc984ff, radius: 112, duration: 220 })
  assert.deepEqual(combatVisualCue('corpse_burst'), { kind: 'corpse-burst', color: 0xff875f, radius: 82, duration: 260 })
  assert.deepEqual(combatVisualCue('piercing'), { kind: 'pierce-trail', color: 0xeafbc9, length: 92, duration: 160 })
  assert.deepEqual(combatVisualCue('heal'), { kind: 'heal-number', color: '#70ff9f', duration: 620 })
  assert.deepEqual(combatVisualCue('critical'), { kind: 'critical-hit', color: '#ffdc68', shake: 0.006, duration: 120 })
})

test('unknown combat visual cues do not invent effects', () => {
  assert.equal(combatVisualCue('unknown'), null)
})
