import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonLootRuntime, installDungeonLootSceneBridge } from './loot-runtime.js'

function sceneFixture() {
  const calls = []
  const scene = {
    drops: [],
    localPlayer: { id: 'local' },
    spawnDrop(x, y, item) {
      const drop = { id: null, x, y, item }
      this.drops.push(drop)
      calls.push(['core-spawn', x, y, item?.type])
      return drop
    },
    destroyDrop(drop) {
      calls.push(['core-remove', drop?.id ?? null])
      this.drops = this.drops.filter((candidate) => candidate !== drop)
      return drop
    },
    clearDrops() {
      calls.push(['core-clear'])
      for (const drop of [...this.drops]) this.destroyDrop(drop)
      this.drops = []
    },
    updateDrops(player) {
      calls.push(['core-step', player?.id ?? null])
    },
  }
  return { scene, calls }
}

test('loot runtime owns behavior without replacing Scene loot methods', () => {
  const { scene } = sceneFixture()
  const originals = {
    spawnDrop: scene.spawnDrop,
    destroyDrop: scene.destroyDrop,
    clearDrops: scene.clearDrops,
    updateDrops: scene.updateDrops,
  }

  const loot = ensureDungeonLootRuntime(scene)
  loot.setSpawnOwner((request, core) => core(request))
  loot.setRemoveOwner((drop, core) => core(drop))
  loot.setClearOwner((core) => core())
  loot.setStepOwner((player, core) => core(player))

  assert.equal(scene.spawnDrop, originals.spawnDrop)
  assert.equal(scene.destroyDrop, originals.destroyDrop)
  assert.equal(scene.clearDrops, originals.clearDrops)
  assert.equal(scene.updateDrops, originals.updateDrops)
})

test('explicit loot scene bridge is installed once and remains stable across owner changes', () => {
  const { scene } = sceneFixture()
  const first = installDungeonLootSceneBridge(scene)
  const refs = {
    spawnDrop: scene.spawnDrop,
    destroyDrop: scene.destroyDrop,
    clearDrops: scene.clearDrops,
    updateDrops: scene.updateDrops,
  }
  const second = installDungeonLootSceneBridge(scene)
  const loot = ensureDungeonLootRuntime(scene)
  const restoreSpawn = loot.setSpawnOwner((request, core) => core(request))
  const restoreStep = loot.setStepOwner((player, core) => core(player))

  assert.equal(second, first)
  assert.equal(scene.spawnDrop, refs.spawnDrop)
  assert.equal(scene.destroyDrop, refs.destroyDrop)
  assert.equal(scene.clearDrops, refs.clearDrops)
  assert.equal(scene.updateDrops, refs.updateDrops)

  restoreStep()
  restoreSpawn()
  assert.equal(scene.spawnDrop, refs.spawnDrop)
  assert.equal(scene.destroyDrop, refs.destroyDrop)
  assert.equal(scene.clearDrops, refs.clearDrops)
  assert.equal(scene.updateDrops, refs.updateDrops)
})

test('authority can reject local spawn before mutation', () => {
  const { scene, calls } = sceneFixture()
  const loot = ensureDungeonLootRuntime(scene)
  loot.setAuthority({ maySpawn: () => false })

  const result = loot.spawn(10, 20, { type: 'weapon.test' })

  assert.equal(result, null)
  assert.equal(scene.drops.length, 0)
  assert.deepEqual(calls, [])
})

test('spawn observer receives the durable drop after owner mutation', () => {
  const { scene } = sceneFixture()
  const loot = ensureDungeonLootRuntime(scene)
  const observed = []
  loot.setSpawnOwner((request, core) => {
    const drop = core(request)
    drop.id = 'drop:ABC123:1:0'
    return drop
  })
  loot.setAuthority({ onSpawned(event) { observed.push(event) } })

  const drop = loot.spawn(10, 20, { type: 'weapon.test' })

  assert.equal(drop.id, 'drop:ABC123:1:0')
  assert.equal(observed.length, 1)
  assert.equal(observed[0].drop, drop)
  assert.equal(observed[0].exact, false)
})

test('spawnExact bypasses preparation while preserving authority and stable identity hooks', () => {
  const { scene } = sceneFixture()
  const loot = ensureDungeonLootRuntime(scene)
  const modes = []
  loot.setSpawnOwner((request, core) => {
    modes.push(request.prepare)
    return core(request)
  })

  loot.spawn(1, 2, { type: 'weapon.a' })
  loot.spawnExact(3, 4, { type: 'weapon.b' })

  assert.deepEqual(modes, [true, false])
  assert.equal(scene.drops.length, 2)
})

test('removeById owns collection removal even when core destroy only tears down presentation', () => {
  const scene = {
    drops: [{ id: 'drop:ABC123:1:0', destroyed: false }],
    destroyDrop(drop) { drop.destroyed = true },
  }
  const loot = ensureDungeonLootRuntime(scene)
  const removed = loot.removeById('drop:ABC123:1:0')

  assert.equal(removed?.destroyed, true)
  assert.deepEqual(scene.drops, [])
})

test('remove observer receives active step player and clear context', () => {
  const { scene } = sceneFixture()
  installDungeonLootSceneBridge(scene)
  const loot = ensureDungeonLootRuntime(scene)
  const events = []
  loot.setAuthority({
    onRemoved(event) {
      events.push({
        id: event.drop.id,
        playerId: event.player?.id ?? null,
        clearing: event.clearing,
      })
    },
  })

  const stepped = loot.spawnExact(1, 2, { type: 'consumable.health_potion' })
  stepped.id = 'step-drop'
  loot.setStepOwner((player) => loot.remove(stepped))
  loot.step({ id: 'p2' })

  const cleared = loot.spawnExact(3, 4, { type: 'weapon.test' })
  cleared.id = 'clear-drop'
  loot.clear()

  assert.deepEqual(events, [
    { id: 'step-drop', playerId: 'p2', clearing: false },
    { id: 'clear-drop', playerId: null, clearing: true },
  ])
})

test('pickup is a stable-id semantic operation with one explicit owner', () => {
  const { scene } = sceneFixture()
  const loot = ensureDungeonLootRuntime(scene)
  const calls = []
  loot.setPickupOwner((player, dropId) => {
    calls.push([player.id, dropId])
    return { picked: true, dropId }
  })

  const result = loot.pickup({ id: 'p2' }, 'drop:ABC123:1:4')

  assert.deepEqual(result, { picked: true, dropId: 'drop:ABC123:1:4' })
  assert.deepEqual(calls, [['p2', 'drop:ABC123:1:4']])
})
