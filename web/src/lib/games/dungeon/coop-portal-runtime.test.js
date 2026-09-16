import test from 'node:test'
import assert from 'node:assert/strict'

import { installCoopPortalRuntime } from './coop-portal-runtime.js'

function label() {
  return {
    text: '',
    x: 0,
    y: 0,
    destroyed: false,
    setOrigin() { return this },
    setDepth() { return this },
    setText(value) { this.text = String(value); return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    destroy() { this.destroyed = true },
  }
}

function player(id, x, y) {
  return { id, dead: false, state: { x, y, hp: 100, maxHp: 100 } }
}

function fixture({ authority = true } = {}) {
  const p1 = player('p1', 100, 100)
  const p2 = player('p2', 200, 100)
  const facts = []
  let advances = 0
  const scene = {
    players: new Map([['p1', p1], ['p2', p2]]),
    portal: { id: 'portal:R:1:0', x: 100, y: 100, unlockAt: 0 },
    runComplete: false,
    add: { text() { return label() } },
    updatePortal() { throw new Error('single-player dwell must not run in co-op') },
    advanceFloor() { advances++ },
  }
  const runtime = installCoopPortalRuntime(scene, {
    localPlayer: p1,
    isAuthority: () => authority,
    publishFact(fact) { facts.push(fact) },
  })
  return { scene, p1, p2, facts, runtime, advances: () => advances }
}

test('team countdown starts only when both living players are inside and resets when either leaves', () => {
  const { scene, p2, facts } = fixture()
  scene.updatePortal(1000)
  assert.equal(scene.portal.countdownLabel ?? null, null)
  assert.equal(facts.length, 0)

  p2.state.x = 104
  scene.updatePortal(1000)
  assert.equal(scene.portal.countdownLabel?.text, '3')
  assert.equal(facts.at(-1)?.type, 'portal.dwell')
  assert.equal(facts.at(-1)?.seconds, 3)

  scene.updatePortal(2000)
  assert.equal(scene.portal.countdownLabel?.text, '2')

  p2.state.x = 200
  scene.updatePortal(2100)
  assert.equal(scene.portal.countdownLabel, null)
  assert.equal(facts.at(-1)?.active, false)
})

test('authority advances exactly once after both players dwell for three seconds', () => {
  const { scene, p2, advances } = fixture()
  p2.state.x = 104
  scene.updatePortal(1000)
  scene.updatePortal(2500)
  scene.updatePortal(4000)
  scene.updatePortal(4100)
  assert.equal(advances(), 1)
  assert.equal(scene.portal?.countdownLabel ?? null, null)
})

test('a new portal starts a fresh party dwell after the previous floor transitioned', () => {
  const { scene, p1, p2, advances } = fixture()
  p2.state.x = 104
  scene.updatePortal(1000)
  scene.updatePortal(4000)
  assert.equal(advances(), 1)

  scene.portal = { id: 'portal:R:2:0', x: 300, y: 300, unlockAt: 0 }
  p1.state.x = 300
  p1.state.y = 300
  p2.state.x = 304
  p2.state.y = 300
  scene.updatePortal(5000)
  scene.updatePortal(8000)

  assert.equal(advances(), 2)
})

test('follower never advances locally and only renders authority countdown facts', () => {
  const { scene, runtime, advances } = fixture({ authority: false })
  scene.updatePortal(1000)
  scene.updatePortal(5000)
  assert.equal(advances(), 0)
  assert.equal(scene.portal.countdownLabel ?? null, null)

  runtime.applyFact({ type: 'portal.dwell', entityId: 'portal:R:1:0', active: true, seconds: 2 })
  assert.equal(scene.portal.countdownLabel?.text, '2')
  runtime.applyFact({ type: 'portal.dwell', entityId: 'portal:R:1:0', active: false, seconds: null })
  assert.equal(scene.portal.countdownLabel, null)
})

test('downed teammate prevents the team countdown from starting', () => {
  const { scene, p2, facts } = fixture()
  p2.state.x = 104
  p2.dead = true
  p2.state.hp = 0
  scene.updatePortal(1000)
  assert.equal(scene.portal.countdownLabel ?? null, null)
  assert.equal(facts.length, 0)
})