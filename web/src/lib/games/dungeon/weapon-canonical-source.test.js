import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { installDungeonWeaponProjectiles } from './weapon-projectile-runtime.js'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'

function weapon(type, signature) {
  return { type, archetype: 'staff', rarity: 'rare', damage: 8, affixes: [], signature }
}

function bow(type) {
  return { type, archetype: 'bow', rarity: 'rare', damage: 8, affixes: [] }
}

test('weapon signature runtime prefers canonical equipment weapon over stale legacy mirrors', () => {
  const player = createPlayerEntity({
    id: 'p1',
    state: {
      x: 0,
      y: 0,
      damage: 20,
      effects: {},
      equipment: { weapon: weapon('weapon.canonical', 'frost_blizzard') },
      equippedWeapon: weapon('weapon.legacy', 'storm_palm'),
      weapon: 'weapon.legacy',
    },
  })
  const scene = {
    localPlayer: player,
    enemies: [],
    damageEnemy() {},
    __dungeonVfx: { lightning() {} },
    __dungeonWeaponVfx: { nova() {} },
  }
  const runtime = installDungeonWeaponSignatures(scene, { player })
  const target = { id: 'target', x: 40, y: 0, hp: 100 }

  runtime.onStaffHit(target, 20)
  runtime.onStaffHit(target, 20)
  runtime.onStaffHit(target, 20)

  assert.equal(runtime.activeCount(), 1)
})

test('ranged cadence resets when the canonical equipment weapon changes', () => {
  const legacy = bow('weapon.legacy')
  const player = createPlayerEntity({
    id: 'p1',
    state: {
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      damage: 20,
      critChance: 0,
      critMultiplier: 2,
      effects: {},
      equipment: { weapon: bow('weapon.canonical-a') },
      equippedWeapon: legacy,
      weapon: legacy.type,
    },
  })
  const scene = {
    localPlayer: player,
    enemies: [],
    slash() {},
    damageEnemy() {},
    healPlayer() {},
    applyWeaponProcs() {},
    syncPlayerAnimation() {},
    events: { on() {}, off() {}, once() {} },
    time: { delayedCall() {} },
    __dungeonVfx: {},
  }
  const runtime = installDungeonWeaponProjectiles(scene, { player, random: () => 0.9 })
  const target = { id: 'target', x: 80, y: 0, hp: 100 }

  runtime.fire(target)
  runtime.fire(target)
  runtime.fire(target)
  player.state.equipment.weapon = bow('weapon.canonical-b')
  const firstAfterSwap = runtime.fire(target)

  assert.equal(firstAfterSwap.powerShot, false)
})
