import test from 'node:test'
import assert from 'node:assert/strict'

import { installCoopPortalRuntime } from './coop-portal-runtime.js'

function player(id, x, y) {
  return { id, dead: false, state: { x, y, hp: 100, maxHp: 100 } }
}

function label() {
  return {
    text: '',
    setOrigin() { return this },
    setDepth() { return this },
    setText(value) { this.text = String(value); return this },
    setPosition() { return this },
    destroy() { this.destroyed = true },
  }
}

test('party portal dwell completes on injected monotonic time while Phaser update time is frozen', () => {
  const p1 = player('p1', 100, 100)
  const p2 = player('p2', 104, 100)
  let logicalNow = 1000
  let advances = 0
  const scene = {
    players: new Map([['p1', p1], ['p2', p2]]),
    portal: { id: 'portal:R:1:0', x: 100, y: 100, unlockAt: 0 },
    runComplete: false,
    add: { text() { return label() } },
    updatePortal() {},
    advanceFloor() { advances++ },
  }

  installCoopPortalRuntime(scene, {
    localPlayer: p1,
    isAuthority: () => true,
    now: () => logicalNow,
  })

  scene.updatePortal(1000)
  assert.equal(scene.portal.countdownLabel?.text, '3')

  logicalNow += 3000
  scene.updatePortal(1000)

  assert.equal(advances, 1)
  assert.equal(scene.portal.countdownLabel ?? null, null)
})
