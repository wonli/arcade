import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonFloorRuntime, installDungeonFloorSceneBridge } from './floor-runtime.js'

function fixture() {
  const events = []
  const scene = {
    floor: 1,
    localPlayer: { id: 'local' },
    advanceFloor(player = this.localPlayer) {
      const from = this.floor
      this.floor++
      events.push(['core', from, this.floor, player.id])
      return this.floor
    },
  }
  return { scene, events }
}

test('floor Scene bridge stays stable across owner policy and authority changes', () => {
  const { scene } = fixture()
  const first = installDungeonFloorSceneBridge(scene)
  const advanceFloor = scene.advanceFloor
  const second = installDungeonFloorSceneBridge(scene)
  const floor = ensureDungeonFloorRuntime(scene)
  const restoreOwner = floor.setAdvanceOwner((player, core) => core(player))
  const restorePolicy = floor.setTransitionPolicy({ beforeAdvance() {}, afterAdvance() {} })
  const restoreAuthority = floor.setAuthority({ mayAdvance: () => true })

  assert.equal(second, first)
  assert.equal(scene.advanceFloor, advanceFloor)

  restoreAuthority()
  restorePolicy()
  restoreOwner()
  assert.equal(scene.advanceFloor, advanceFloor)
})

test('floor authority rejects mutation and observes successful floor changes', () => {
  const { scene, events } = fixture()
  installDungeonFloorSceneBridge(scene)
  const floor = ensureDungeonFloorRuntime(scene)
  const observed = []
  floor.setAdvanceOwner((player, core) => core(player))
  floor.setAuthority({ mayAdvance: () => false, onAdvanced(event) { observed.push(event) } })

  assert.equal(scene.advanceFloor(scene.localPlayer), null)
  assert.equal(scene.floor, 1)
  assert.deepEqual(events, [])

  floor.setAuthority({ mayAdvance: () => true, onAdvanced(event) { observed.push(event) } })
  assert.equal(scene.advanceFloor(scene.localPlayer), 2)
  assert.equal(scene.floor, 2)
  assert.equal(observed.length, 1)
  assert.equal(observed[0].fromFloor, 1)
  assert.equal(observed[0].toFloor, 2)
})

test('transition policy may handle a transition without invoking the progression owner', () => {
  const { scene, events } = fixture()
  installDungeonFloorSceneBridge(scene)
  const floor = ensureDungeonFloorRuntime(scene)
  const policyEvents = []
  floor.setAdvanceOwner((player, core) => core(player))
  floor.setTransitionPolicy({
    beforeAdvance({ context }) {
      policyEvents.push(['before', context.direction])
      if (context.direction === 'cached') {
        scene.floor = 7
        return { handled: true, value: 'restored' }
      }
      return { handled: false }
    },
    afterAdvance({ handled, fromFloor, toFloor }) {
      policyEvents.push(['after', handled, fromFloor, toFloor])
    },
  })

  assert.equal(floor.advance(scene.localPlayer, { direction: 'cached' }), 'restored')
  assert.equal(scene.floor, 7)
  assert.deepEqual(events, [])
  assert.deepEqual(policyEvents, [['before', 'cached'], ['after', true, 1, 7]])
})
