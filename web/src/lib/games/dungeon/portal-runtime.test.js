import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ensureDungeonPortalRuntime,
  installDungeonPortalSceneBridge,
} from './portal-runtime.js'

function fixture() {
  const calls = []
  const scene = {
    updatePortal(time) {
      calls.push(['core', time])
      return time
    },
  }
  return { scene, calls }
}

test('portal Scene bridge is installed once and remains stable across owner changes', () => {
  const { scene } = fixture()
  const first = installDungeonPortalSceneBridge(scene)
  const updatePortal = scene.updatePortal
  const second = installDungeonPortalSceneBridge(scene)
  const portal = ensureDungeonPortalRuntime(scene)
  const restore = portal.setUpdateOwner((time, core) => core(time))

  assert.equal(second, first)
  assert.equal(scene.updatePortal, updatePortal)

  restore()
  assert.equal(scene.updatePortal, updatePortal)
})

test('portal update owner can delegate to the captured single-player core without replacing Scene', () => {
  const { scene, calls } = fixture()
  installDungeonPortalSceneBridge(scene)
  const updatePortal = scene.updatePortal
  const portal = ensureDungeonPortalRuntime(scene)
  portal.setUpdateOwner((time, core) => {
    calls.push(['owner', time])
    return core(time)
  })

  const result = scene.updatePortal(1234)

  assert.equal(scene.updatePortal, updatePortal)
  assert.equal(result, 1234)
  assert.deepEqual(calls, [['owner', 1234], ['core', 1234]])
})
