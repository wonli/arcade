import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonCapabilities } from './gameplay-capabilities.js'

test('capability installation keeps one stable CombatRuntime and LootRuntime owner', () => {
  const scene = {
    autoAttack() { return 'base' },
    spawnDrop() {},
    destroyDrop() {},
    clearDrops() {},
    updateDrops() {},
  }

  const first = ensureDungeonCapabilities(scene)
  const firstCombat = first.combat
  const firstLoot = first.loot
  const second = ensureDungeonCapabilities(scene)

  assert.equal(second, first)
  assert.equal(second.combat, firstCombat)
  assert.equal(second.loot, firstLoot)
  assert.equal(second.combat.__dungeonCombatRuntime, true)
  assert.equal(second.loot.__dungeonLootRuntime, true)
})

test('combat core is captured once while explicit owners can be installed and restored', () => {
  const calls = []
  const scene = {
    autoAttack(time, player) {
      calls.push(['base', time, player.id])
      player.lastAttackAt = time
    },
  }
  const player = { id: 'p2', lastAttackAt: 0 }
  const combat = ensureDungeonCapabilities(scene).combat

  scene.autoAttack = (time, nextPlayer) => {
    calls.push(['late-scene-replacement', time, nextPlayer.id])
  }
  combat.attack(player, 100)

  const restore = combat.setAttackOwner((nextPlayer, time) => {
    calls.push(['owner', time, nextPlayer.id])
    nextPlayer.lastAttackAt = time
  })
  combat.attack(player, 200)
  restore()
  combat.attack(player, 300)

  assert.deepEqual(calls, [
    ['base', 100, 'p2'],
    ['owner', 200, 'p2'],
    ['base', 300, 'p2'],
  ])
})

test('loot core is captured once while semantic pickup owner can be rebound explicitly', () => {
  const calls = []
  const scene = {
    spawnDrop(x, y, item) {
      const drop = { x, y, item }
      this.drops ??= []
      this.drops.push(drop)
      return drop
    },
    destroyDrop() {},
    clearDrops() {},
    updateDrops() {},
    dungeon: {
      loot: {
        pickup(player, dropId) {
          calls.push(['pickup-v1', dropId, player.id])
          return { picked: true }
        },
      },
    },
  }
  const player = { id: 'p2' }
  const loot = ensureDungeonCapabilities(scene).loot

  loot.pickup(player, 'drop-1')
  const restore = loot.setPickupOwner((nextPlayer, dropId) => {
    calls.push(['pickup-v2', dropId, nextPlayer.id])
    return { picked: true }
  })
  loot.pickup(player, 'drop-2')
  restore()
  loot.pickup(player, 'drop-3')

  assert.deepEqual(calls, [
    ['pickup-v1', 'drop-1', 'p2'],
    ['pickup-v2', 'drop-2', 'p2'],
    ['pickup-v1', 'drop-3', 'p2'],
  ])
})
