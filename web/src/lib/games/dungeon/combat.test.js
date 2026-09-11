import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nearestTarget,
  rollDamage,
  rollDrop,
  rollEquipment,
  rollPotion,
  enemyArchetype,
  floorWave,
  bossProfile,
  bossReward,
  applyPickup,
} from './combat.js'

test('nearestTarget ignores dead enemies and picks the closest living target', () => {
  const player = { x: 0, y: 0 }
  const enemies = [
    { id: 'dead', x: 1, y: 0, hp: 0 },
    { id: 'far', x: 9, y: 0, hp: 20 },
    { id: 'near', x: 3, y: 4, hp: 20 },
  ]
  assert.equal(nearestTarget(player, enemies)?.id, 'near')
})

test('rollDamage uses crit multiplier deterministically', () => {
  assert.deepEqual(rollDamage({ damage: 12, critChance: 0.2, critMultiplier: 2 }, () => 0.1), { damage: 24, critical: true })
  assert.deepEqual(rollDamage({ damage: 12, critChance: 0.2, critMultiplier: 2 }, () => 0.9), { damage: 12, critical: false })
})

test('rollDrop keeps the legacy single-roll behavior', () => {
  assert.deepEqual(rollDrop(7, () => 0.02), { type: 'weapon.rust_sword', rarity: 'uncommon', damage: 3 })
  assert.deepEqual(rollDrop(7, () => 0.22), { type: 'consumable.health_potion', rarity: 'common', heal: 28 })
  assert.equal(rollDrop(7, () => 0.9), null)
})

test('equipment rarity improves on deeper floors and damage follows rarity', () => {
  assert.deepEqual(rollEquipment(1, () => 0.02), { type: 'weapon.dungeon_blade', rarity: 'common', damage: 2 })
  assert.equal(rollEquipment(1, () => 0.17)?.rarity, 'uncommon')
  assert.equal(rollEquipment(5, () => 0.17)?.rarity, 'rare')
  assert.equal(rollEquipment(5, () => 0.99), null)
})

test('potions roll independently from equipment', () => {
  assert.deepEqual(rollPotion(() => 0.05), { type: 'consumable.health_potion', rarity: 'common', heal: 28 })
  assert.equal(rollPotion(() => 0.5), null)
})

test('enemy archetypes expose distinct combat profiles', () => {
  assert.equal(enemyArchetype(1, () => 0).type, 'skeleton')
  assert.equal(enemyArchetype(2, () => 0.55).type, 'fast')
  assert.equal(enemyArchetype(3, () => 0.9).type, 'brute')
})

test('floor five focuses on one boss with fewer trash enemies', () => {
  assert.deepEqual(floorWave(1), { count: 12, eliteCount: 0 })
  const floorFive = floorWave(5)
  assert.equal(floorFive.eliteCount, 1)
  assert.ok(floorFive.count < 20)
})

test('floor five boss is materially stronger and has a second phase', () => {
  const boss = bossProfile(5)
  assert.ok(boss.hpMultiplier >= 6)
  assert.equal(boss.phaseThreshold, 0.5)
  assert.ok(boss.scale >= 1.6)
  assert.ok(boss.contactDamage >= 20)
  assert.ok(boss.chargeCooldown > 0)
  assert.ok(boss.shockwaveCooldown > 0)
})

test('boss reward is always rare or epic', () => {
  assert.equal(bossReward(() => 0.1).rarity, 'rare')
  assert.equal(bossReward(() => 0.95).rarity, 'epic')
  assert.ok(bossReward(() => 0.95).damage >= bossReward(() => 0.1).damage)
})

test('picking up generated equipment immediately increases damage and preserves rarity', () => {
  const player = { damage: 10, weapon: null, weaponRarity: null }
  const next = applyPickup(player, { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 7 })
  assert.equal(next.damage, 17)
  assert.equal(next.weapon, 'weapon.dungeon_blade')
  assert.equal(next.weaponRarity, 'rare')
})

test('picking up a health potion heals without exceeding max hp', () => {
  assert.equal(applyPickup({ hp: 40, maxHp: 100 }, { type: 'consumable.health_potion', heal: 28 }).hp, 68)
  assert.equal(applyPickup({ hp: 90, maxHp: 100 }, { type: 'consumable.health_potion', heal: 28 }).hp, 100)
})
