import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGENDARY_WEAPON_CATALOG,
  materializeBossLegendary,
  rollBossLegendary,
} from './legendary-weapons.js'

test('all 12 Boss legendary swords materialize at Lv1 with immutable base snapshots', () => {
  assert.equal(LEGENDARY_WEAPON_CATALOG.length, 12)
  for (const definition of LEGENDARY_WEAPON_CATALOG) {
    const item = materializeBossLegendary(definition, 12)
    assert.equal(item.rarity, 'legendary')
    assert.equal(item.legendaryLevel, 1)
    assert.ok(item.legendaryBaseDamage > definition.baseDamage * 2)
    assert.equal(item.legendaryBaseAffixes.length, 4)
    assert.equal(item.signatureAffixes.length, 2)
    assert.equal(item.affixes.length, 4)
    assert.ok(item.damage >= item.legendaryBaseDamage)
  }
})

test('Boss legendary selection remains stable across the 12-item pool', () => {
  assert.equal(rollBossLegendary(5, () => 0).type, 'weapon.kings_ruin')
  assert.equal(rollBossLegendary(5, () => 0.999999).type, 'weapon.crimson_verdict')
})

test('deep-floor legendary base damage grows monotonically', () => {
  const shallow = materializeBossLegendary(LEGENDARY_WEAPON_CATALOG[0], 5)
  const deep = materializeBossLegendary(LEGENDARY_WEAPON_CATALOG[0], 25)
  assert.ok(deep.damage > shallow.damage)
})


test('deep-floor legendary baseline stays materially above same-floor epic damage', () => {
  const floor = 50
  const legendary = materializeBossLegendary(LEGENDARY_WEAPON_CATALOG[0], floor)
  const depth = floor - 1
  const epicUpper = 24 + Math.round(depth * 1.35 + depth * depth * 0.035)
  assert.ok(legendary.damage > epicUpper * 1.20)
})


test('signature power makes the practical legendary hit materially exceed the epic baseline', () => {
  const floor = 50
  const legendary = materializeBossLegendary(LEGENDARY_WEAPON_CATALOG[0], floor)
  const power = legendary.affixes.find((entry) => entry.id === 'power')?.value ?? 0
  const practicalDamage = legendary.damage * (1 + power)
  const depth = floor - 1
  const epicUpper = 24 + Math.round(depth * 1.35 + depth * depth * 0.035)
  assert.ok(practicalDamage > epicUpper * 1.8)
})
