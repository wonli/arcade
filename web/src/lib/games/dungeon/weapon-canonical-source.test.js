import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'

function weapon(type, signature) {
  return { type, archetype: 'staff', rarity: 'rare', damage: 8, affixes: [], signature }
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
