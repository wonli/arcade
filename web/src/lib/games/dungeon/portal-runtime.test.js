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
    updatePortal(time) {
      calls.push(['core-update', time])
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
  const restoreUpdate = portal.setUpdateOwner((time, core) => core(time))

  assert.equal(second, first)
  assert.equal(scene.openPortal, refs.openPortal)
  assert.equal(scene.updatePortal, refs.updatePortal)

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
  portal.setUpdateOwner((time, core) => {
    calls.push(['owner-update', time])
    return core(time)
  })

  const result = scene.updatePortal(1234)

  assert.equal(scene.updatePortal, updatePortal)
  assert.equal(result, 1234)
  assert.deepEqual(calls, [['owner-update', 1234], ['core-update', 1234]])
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
