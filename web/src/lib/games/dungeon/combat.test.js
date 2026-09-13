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
  modifiedDamage,
  attackInterval,
  skillProfile,
  healFromHit,
  secondaryTarget,
} from './combat.js'
import { AFFIXES, affixSlots } from './affixes.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'

const sequence = (values) => { let index = 0; return () => values[index++ % values.length] }

test('nearestTarget ignores dead enemies and picks the closest living target', () => {
  const player = { x: 0, y: 0 }
  const enemies = [{ id: 'dead', x: 1, y: 0, hp: 0 }, { id: 'far', x: 9, y: 0, hp: 20 }, { id: 'near', x: 3, y: 4, hp: 20 }]
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

test('generated equipment carries rarity slots and a weapon archetype', () => {
  const common = rollEquipment(1, sequence([0.02, 0.1]))
  assert.equal(common.rarity, 'common'); assert.equal(common.damage, 2); assert.equal(common.archetype, 'dagger'); assert.deepEqual(common.affixes, [])
  const uncommon = rollEquipment(1, sequence([0.17, 0.45, 0.1, 0.3]))
  assert.equal(uncommon.rarity, 'uncommon'); assert.equal(uncommon.archetype, 'sword'); assert.equal(uncommon.affixes.length, affixSlots('uncommon'))
  const epic = rollEquipment(5, sequence([0.23, 0.9, 0.98, 0.5, 0.97, 0.4, 0.96, 0.3]))
  assert.equal(epic.rarity, 'epic'); assert.equal(epic.archetype, 'katana'); assert.equal(epic.affixes.length, affixSlots('epic')); assert.ok(epic.affixes.some((entry) => AFFIXES[entry.id].category === 'build'))
  assert.equal(rollEquipment(5, () => 0.99), null)
})

test('potions roll independently from equipment', () => {
  assert.deepEqual(rollPotion(() => 0.05), { type: 'consumable.health_potion', rarity: 'common', heal: 28 }); assert.equal(rollPotion(() => 0.5), null)
})

test('enemy archetypes expose distinct combat profiles', () => {
  assert.equal(enemyArchetype(1, () => 0).type, 'skeleton'); assert.equal(enemyArchetype(2, () => 0.55).type, 'fast'); assert.equal(enemyArchetype(3, () => 0.9).type, 'brute')
})

test('ranged enemies enter the mix from floor three onward', () => {
  assert.notEqual(enemyArchetype(2, () => 0.7).type, 'ranged'); const ranged = enemyArchetype(3, () => 0.7); assert.equal(ranged.type, 'ranged'); assert.ok(ranged.attackRange >= 180); assert.ok(ranged.projectileDamage > 0); assert.ok(ranged.projectileCooldown > 0)
})

test('floor five focuses on one boss with fewer trash enemies', () => {
  assert.deepEqual(floorWave(1), { count: 12, eliteCount: 0 }); const floorFive = floorWave(5); assert.equal(floorFive.eliteCount, 1); assert.ok(floorFive.count < 20)
})

test('floor five boss is materially stronger and has a second phase', () => {
  const boss = bossProfile(5); assert.ok(boss.hpMultiplier >= 6); assert.equal(boss.phaseThreshold, 0.5); assert.ok(boss.scale >= 1.6); assert.ok(boss.contactDamage >= 20); assert.ok(boss.chargeCooldown > 0); assert.ok(boss.shockwaveCooldown > 0)
})

test('boss reward is rare or epic, has archetype, and always carries a build affix', () => {
  const rare = bossReward(sequence([0.1, 0.1, 0.4, 0.2, 0.6, 0.3]), 5)
  const epic = bossReward(sequence([0.95, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4]), 5)
  assert.equal(rare.rarity, 'rare'); assert.equal(epic.rarity, 'epic'); assert.ok(['dagger', 'sword', 'katana'].includes(rare.archetype)); assert.ok(['dagger', 'sword', 'katana'].includes(epic.archetype)); assert.ok(rare.affixes.some((entry) => AFFIXES[entry.id].category === 'build')); assert.ok(epic.affixes.some((entry) => AFFIXES[entry.id].category === 'build')); assert.equal(rare.affixes.length, 2); assert.equal(epic.affixes.length, 3)
})

test('weapon pickups replace equipment-derived power and preserve archetype', () => {
  const baseStats = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
  const player = { ...baseStats, hp: 100, baseStats, weapon: null, weaponRarity: null }
  const first = applyPickup(player, { type: 'weapon.dungeon_blade', archetype: 'katana', rarity: 'rare', damage: 12, affixes: [{ id: 'power', tier: 2, value: 0.2 }, { id: 'critical', tier: 2, value: 0.05 }] }, baseStats)
  const replacement = applyPickup(first, { type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'uncommon', damage: 4, affixes: [{ id: 'movement_speed', tier: 1, value: 0.08 }] }, baseStats)
  assert.ok(first.damage > replacement.damage); assert.equal(replacement.damage, 14); assert.equal(replacement.critChance, 0.18); assert.equal(replacement.weaponRarity, 'uncommon'); assert.equal(replacement.weaponAffixes.length, 1); assert.equal(replacement.equippedWeapon.archetype, 'dagger')
})

test('target-aware modifiers reward low-health and executioner builds', () => {
  assert.equal(modifiedDamage({ hp: 100, maxHp: 100, effects: {} }, { hp: 100, maxHp: 100 }, 20), 20); assert.equal(modifiedDamage({ hp: 35, maxHp: 100, effects: { lowHealthDamage: 0.25 } }, { hp: 100, maxHp: 100 }, 20), 25); assert.equal(modifiedDamage({ hp: 100, maxHp: 100, effects: { executioner: 0.5 } }, { hp: 20, maxHp: 100 }, 20), 30)
})

test('attack interval keeps haste behavior and applies weapon cadence', () => {
  const sword = attackInterval({ hp: 100, maxHp: 100, effects: {}, equippedWeapon: { archetype: 'sword' } }, 1000)
  const dagger = attackInterval({ hp: 100, maxHp: 100, effects: {}, equippedWeapon: { archetype: 'dagger' } }, 1000)
  const katana = attackInterval({ hp: 100, maxHp: 100, effects: {}, equippedWeapon: { archetype: 'katana' } }, 1000)
  const geared = attackInterval({ hp: 100, maxHp: 100, effects: { attackSpeed: 0.2 }, equippedWeapon: { archetype: 'sword' } }, 1000)
  assert.ok(dagger < sword); assert.ok(katana > sword); assert.ok(geared < sword)
})

test('weapon profiles produce distinct direct-hit damage, knockback, and range', () => {
  const dagger = { equippedWeapon: { archetype: 'dagger' } }, sword = { equippedWeapon: { archetype: 'sword' } }, katana = { equippedWeapon: { archetype: 'katana' } }
  assert.equal(weaponProfile(dagger).range, 132); assert.equal(weaponProfile(sword).range, 165); assert.equal(weaponProfile(katana).range, 196)
  assert.ok(weaponAttackDamage(dagger, 20) < weaponAttackDamage(sword, 20)); assert.ok(weaponAttackDamage(katana, 20) > weaponAttackDamage(sword, 20)); assert.ok(weaponAttackKnockback(dagger, 22) < 22); assert.ok(weaponAttackKnockback(katana, 22) > 22)
})

test('skill profile scales radius up and cooldown down', () => {
  assert.deepEqual(skillProfile({ effects: {} }), { radius: 130, cooldown: 4200 }); const boosted = skillProfile({ effects: { skillRadius: 0.25, skillHaste: 0.2 } }); assert.equal(boosted.radius, 163); assert.equal(boosted.cooldown, 3360)
})

test('hit healing combines direct life steal and critical heal only for direct hits', () => {
  const player = { effects: { lifeSteal: 0.1, criticalHeal: 6 } }; assert.equal(healFromHit(player, 50, false, { direct: true }), 5); assert.equal(healFromHit(player, 50, true, { direct: true }), 11); assert.equal(healFromHit(player, 50, true, { direct: false }), 0)
})

test('secondaryTarget excludes dead and primary enemies and respects range', () => {
  const primary = { id: 'primary', x: 100, y: 100, hp: 20 }; const enemies = [primary, { id: 'dead', x: 105, y: 100, hp: 0 }, { id: 'near', x: 135, y: 100, hp: 20 }, { id: 'far', x: 400, y: 100, hp: 20 }]; assert.equal(secondaryTarget(primary, enemies, 120)?.id, 'near'); assert.equal(secondaryTarget(primary, [primary, enemies[1], enemies[3]], 120), null)
})

test('picking up a health potion heals without exceeding max hp', () => {
  assert.equal(applyPickup({ hp: 40, maxHp: 100 }, { type: 'consumable.health_potion', heal: 28 }).hp, 68); assert.equal(applyPickup({ hp: 90, maxHp: 100 }, { type: 'consumable.health_potion', heal: 28 }).hp, 100)
})