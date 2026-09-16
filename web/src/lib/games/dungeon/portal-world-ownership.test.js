import test from 'node:test'
import assert from 'node:assert/strict'

import { createDungeonWorldRuntime, stableWorldEntityId } from './world-runtime.js'

function displayObject() {
  return {
    destroyed: 0,
    positions: [],
    destroy() { this.destroyed++ },
    setPosition(x, y) { this.positions.push([x, y]); return this },
  }
}

function sceneFixture() {
  const portalId = stableWorldEntityId('ABC123', 1, 'portal', 0)
  const portal = {
    id: portalId,
    x: 480,
    y: 300,
    glow: displayObject(),
    ring: displayObject(),
    core: displayObject(),
    countdownLabel: displayObject(),
  }
  let opens = 0
  let destroys = 0
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: true,
    runComplete: false,
    enemies: [],
    drops: [],
    players: new Map(),
    portal,
    time: { now: 1000 },
    clearDrops() { this.drops = [] },
    openPortal() {
      opens++
      this.portal = {
        x: 480,
        y: 300,
        glow: displayObject(),
        ring: displayObject(),
        core: displayObject(),
      }
      return this.portal
    },
    destroyPortal() {
      if (!this.portal) return
      destroys++
      this.portal.glow?.destroy?.()
      this.portal.ring?.destroy?.()
      this.portal.core?.destroy?.()
      this.portal = null
    },
  }
  return { scene, portal, portalId, opens: () => opens, destroys: () => destroys }
}

test('reapplying the same canonical portal keeps one presentation instance', () => {
  const { scene, portal, portalId, opens, destroys } = sceneFixture()
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })
  const world = (sequence) => ({
    type: 'world.state',
    runSeed: 'ABC123',
    sequence,
    floor: 1,
    floorCleared: true,
    enemies: [],
    drops: [],
    portal: { entityId: portalId, x: 480, y: 300 },
  })

  runtime.applyFact(world(1))
  runtime.applyFact(world(2))

  assert.equal(scene.portal, portal)
  assert.equal(opens(), 0)
  assert.equal(destroys(), 0)
  assert.equal(portal.countdownLabel.destroyed, 0)
})

test('canonical portal removal destroys the presentation and countdown once and remains idempotent', () => {
  const { scene, portal, destroys } = sceneFixture()
  const countdownLabel = portal.countdownLabel
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })
  const world = (sequence) => ({
    type: 'world.state',
    runSeed: 'ABC123',
    sequence,
    floor: 1,
    floorCleared: false,
    enemies: [],
    drops: [],
    portal: null,
  })

  runtime.applyFact(world(1))
  runtime.applyFact(world(2))

  assert.equal(scene.portal, null)
  assert.equal(destroys(), 1)
  assert.equal(portal.glow.destroyed, 1)
  assert.equal(portal.ring.destroyed, 1)
  assert.equal(portal.core.destroyed, 1)
  assert.equal(portal.countdownLabel, null)
  assert.equal(countdownLabel.destroyed, 1)
})
