import test from 'node:test'
import assert from 'node:assert/strict'
import {
  growLegendary,
  legendaryAwakening,
  legendaryVfxTarget,
  materializeLegendary,
  normalizeLegendary,
} from './legendary-growth.js'

const sample = {
  type: 'weapon.stormcrown',
  rarity: 'legendary',
  damage: 100,
  affixes: [
    { id: 'thunder', tier: 4, value: 0.85 },
    { id: 'chain', tier: 4, value: 0.80 },
  ],
  signatureAffixes: ['thunder', 'chain'],
}

test('legendary snapshots are immutable and same-level materialization is idempotent', () => {
  const normalized = normalizeLegendary(sample)
  const once = materializeLegendary(normalized, 10)
  const twice = materializeLegendary(once, 10)
  assert.equal(once.damage, twice.damage)
  assert.deepEqual(once.affixes, twice.affixes)
  assert.equal(once.legendaryBaseDamage, 100)
  assert.deepEqual(once.legendaryBaseAffixes, sample.affixes)
})

test('legendary growth has milestone awakenings and a hard Lv20 cap', () => {
  assert.equal(legendaryAwakening(1), 0)
  assert.equal(legendaryAwakening(5), 1)
  assert.equal(legendaryAwakening(10), 2)
  assert.equal(legendaryAwakening(15), 3)
  assert.equal(legendaryAwakening(20), 4)
  assert.equal(growLegendary({ ...sample, legendaryLevel: 20 }).legendaryLevel, 20)
})

test('legendary VFX targets stay pixel-sized by awakening', () => {
  assert.deepEqual([1, 5, 10, 15, 20].map((level) => legendaryVfxTarget({ rarity: 'legendary', legendaryLevel: level }).size), [16, 18, 20, 22, 24])
  assert.deepEqual([1, 5, 10, 15, 20].map((level) => legendaryVfxTarget({ rarity: 'legendary', legendaryLevel: level }).burst), [12, 14, 16, 18, 20])
})

test('only combat-capable rooms grow an equipped legendary', async () => {
  const { growLegendaryForRoom } = await import('./legendary-growth.js')
  const weapon = materializeLegendary(sample, 1)
  for (const role of ['combat', 'elite', 'boss', 'antechamber']) {
    assert.equal(growLegendaryForRoom(weapon, role).legendaryLevel, 2, role)
  }
  for (const role of ['rest', 'treasure']) {
    assert.equal(growLegendaryForRoom(weapon, role).legendaryLevel, 1, role)
  }
})

test('room growth re-derives player combat stats from the grown legendary', async () => {
  const { growPlayerLegendaryForRoom } = await import('./legendary-growth.js')
  const weapon = materializeLegendary(sample, 1)
  const player = {
    hp: 100, maxHp: 100, damage: 110, critChance: 0.18, speed: 190,
    baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
    equippedWeapon: weapon,
  }
  const result = growPlayerLegendaryForRoom(player, 'combat')
  assert.equal(result.grew, true)
  assert.equal(result.playerState.equippedWeapon.legendaryLevel, 2)
  assert.equal(result.playerState.weaponDamage, result.playerState.equippedWeapon.damage)
  assert.ok(result.playerState.damage > player.damage)
  assert.equal(result.level, 2)

  const rest = growPlayerLegendaryForRoom(player, 'rest')
  assert.equal(rest.grew, false)
  assert.equal(rest.playerState, player)
})
