import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonCapabilities } from './gameplay-capabilities.js'

test('capability installation is stable and does not replace existing owners', () => {
  const ownedAttack = () => 'owned'
  const scene = {
    dungeon: { combat: { attack: ownedAttack } },
  }

  const first = ensureDungeonCapabilities(scene)
  const firstCombat = first.combat
  const firstLoot = first.loot
  const second = ensureDungeonCapabilities(scene)

  assert.equal(second, first)
  assert.equal(second.combat, firstCombat)
  assert.equal(second.loot, firstLoot)
  assert.equal(second.combat.attack, ownedAttack)
})

test('compatibility capabilities delegate to the current legacy gameplay owners without capturing stale methods', () => {
  const calls = []
  const scene = {
    autoAttack(time, player) {
      calls.push(['attack-v1', time, player.id])
      player.lastAttackAt = time
    },
    __dungeonPickupRuntime: {
      pickupById(player, dropId) {
        calls.push(['pickup', dropId, player.id])
        return { picked: true }
      },
    },
    __dungeonSpatial: {
      openChestById(player, chestId) {
        calls.push(['chest', chestId, player.id])
        return { opened: true }
      },
    },
  }
  const player = { id: 'p2', lastAttackAt: 0 }
  const capabilities = ensureDungeonCapabilities(scene)

  capabilities.combat.attack(player, 100)
  scene.autoAttack = (time, nextPlayer) => {
    calls.push(['attack-v2', time, nextPlayer.id])
    nextPlayer.lastAttackAt = time
  }
  capabilities.combat.attack(player, 200)
  capabilities.loot.pickup(player, 'drop-1')
  capabilities.loot.openChest(player, 'chest-1')

  assert.deepEqual(calls, [
    ['attack-v1', 100, 'p2'],
    ['attack-v2', 200, 'p2'],
    ['pickup', 'drop-1', 'p2'],
    ['chest', 'chest-1', 'p2'],
  ])
})
