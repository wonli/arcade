import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ensureDungeonPortalRuntime,
  installDungeonPortalSceneBridge,
} from './portal-runtime.js'

function fixture() {
  const calls = []
  const scene = {
    portal: null,
    localPlayer: { id: 'local' },
    openPortal(player = this.localPlayer) {
      calls.push(['core-open', player?.id ?? null])
      this.portal = { id: null, x: 100, y: 100 }
      return this.portal
    },
    updatePortal(time, player = this.localPlayer) {
      calls.push(['core-update', time, player?.id ?? null])
      return time
    },
  }
  return { scene, calls }
}

test('portal Scene bridge is installed once and remains stable across owner changes', () => {
  const { scene } = fixture()
  const first = installDungeonPortalSceneBridge(scene)
  const refs = { openPortal: scene.openPortal, updatePortal: scene.updatePortal }
  const second = installDungeonPortalSceneBridge(scene)
  const portal = ensureDungeonPortalRuntime(scene)
  const restoreOpen = portal.setOpenOwner((player, core) => core(player))
  const restoreUpdate = portal.setUpdateOwner((time, core, player) => core(time, player))
  const restorePolicy = portal.setUpdatePolicy({ beforeUpdate() { return { handled: false } } })

  assert.equal(second, first)
  assert.equal(scene.openPortal, refs.openPortal)
  assert.equal(scene.updatePortal, refs.updatePortal)

  restorePolicy()
  restoreUpdate()
  restoreOpen()
  assert.equal(scene.openPortal, refs.openPortal)
  assert.equal(scene.updatePortal, refs.updatePortal)
})

test('portal update owner can delegate to the captured single-player core without replacing Scene', () => {
  const { scene, calls } = fixture()
  installDungeonPortalSceneBridge(scene)
  const updatePortal = scene.updatePortal
  const portal = ensureDungeonPortalRuntime(scene)
  portal.setUpdateOwner((time, core, player) => {
    calls.push(['owner-update', time, player?.id ?? null])
    return core(time, player)
  })

  const result = scene.updatePortal(1234, scene.localPlayer)

  assert.equal(scene.updatePortal, updatePortal)
  assert.equal(result, 1234)
  assert.deepEqual(calls, [
    ['owner-update', 1234, 'local'],
    ['core-update', 1234, 'local'],
  ])
})

test('portal update policy may handle single-player updates but defers when an explicit owner exists', () => {
  const { scene, calls } = fixture()
  installDungeonPortalSceneBridge(scene)
  const portal = ensureDungeonPortalRuntime(scene)
  const policyEvents = []
  portal.setUpdatePolicy({
    beforeUpdate(event) {
      policyEvents.push([event.time, event.hasUpdateOwner])
      if (!event.hasUpdateOwner) return { handled: true, value: 'policy' }
      return { handled: false }
    },
  })

  assert.equal(scene.updatePortal(100, scene.localPlayer), 'policy')
  assert.deepEqual(calls, [])

  portal.setUpdateOwner((time, _core, player) => {
    calls.push(['owner-update', time, player?.id ?? null])
    return 'owner'
  })

  assert.equal(scene.updatePortal(200, scene.localPlayer), 'owner')
  assert.deepEqual(policyEvents, [[100, false], [200, true]])
  assert.deepEqual(calls, [['owner-update', 200, 'local']])
})

test('portal open authority gates mutation and observes the materialized portal', () => {
  const { scene, calls } = fixture()
  installDungeonPortalSceneBridge(scene)
  const portal = ensureDungeonPortalRuntime(scene)
  const observed = []
  portal.setOpenOwner((player, core) => core(player))
  portal.setAuthority({
    mayOpen: () => false,
    onOpened(event) { observed.push(event) },
  })

  assert.equal(scene.openPortal(scene.localPlayer), null)
  assert.equal(scene.portal, null)
  assert.deepEqual(calls, [])
  assert.deepEqual(observed, [])

  portal.setAuthority({
    mayOpen: () => true,
    onOpened(event) { observed.push(event) },
  })
  const opened = scene.openPortal(scene.localPlayer)

  assert.equal(opened, scene.portal)
  assert.equal(observed.length, 1)
  assert.equal(observed[0].portal, scene.portal)
  assert.deepEqual(calls, [['core-open', 'local']])
})
