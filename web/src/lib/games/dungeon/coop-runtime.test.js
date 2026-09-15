import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { acceptRemoteInput, consumeRemoteInput, nextGuestInput } from './coop-runtime.js'

test('host accepts only newer normalized intent and ignores guest position fields', () => {
  const first = acceptRemoteInput(null, { seq: 4, moveX: 2, moveY: 0, x: 900, y: 500, skill: true })
  assert.equal(first.seq, 4)
  assert.equal(first.moveX, 1)
  assert.equal(first.moveY, 0)
  assert.equal(first.skill, true)
  assert.equal('x' in first, false)
  assert.equal('y' in first, false)

  const stale = acceptRemoteInput(first, { seq: 3, moveX: -1 })
  assert.equal(stale, first)
})

test('one-shot remote actions are latched then consumed once', () => {
  const latched = acceptRemoteInput({ seq: 4, moveX: 0, moveY: 0, skill: true, interact: false }, { seq: 5, moveX: 1, moveY: 0 })
  assert.equal(latched.skill, true)
  const { current, remaining } = consumeRemoteInput(latched)
  assert.equal(current.skill, true)
  assert.equal(remaining.skill, false)
  assert.equal(remaining.moveX, 1)
})

test('guest packet sequence increases and pending actions survive the 20Hz send cadence', () => {
  const packet = nextGuestInput({ moveX: 0.5, moveY: -0.5 }, 11, { skill: true, interact: true })
  assert.equal(packet.seq, 12)
  assert.equal(packet.skill, true)
  assert.equal(packet.interact, true)
})

test('co-op runtime uses semantic facts and deterministic world instead of mirror renderers', () => {
  const source = readFileSync(new URL('./coop-runtime.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /applyDropSnapshot|applyEnemySnapshot|__coopPortalMirror|snapshot\.geometry|updateMirroredDropVisuals/)
  assert.match(source, /installDeterministicCoopWorld/)
  assert.match(source, /spawnExact/)
  assert.match(source, /drop\.spawn/)
  assert.match(source, /player\.attack/)
  assert.match(source, /enemy\.hit/)
  assert.match(source, /dungeonPlayerRuntime/)
})

test('host floor changes re-place both role slots before publishing the next floor', () => {
  const source = readFileSync(new URL('./coop-runtime.js', import.meta.url), 'utf8')
  const floorBranch = source.match(/if \(scene\.floor !== lastFloor\) \{([\s\S]*?)\n    \}/)?.[1] ?? ''
  assert.match(floorBranch, /placePlayers\(\)/)
  assert.match(floorBranch, /emitEvent\('floor\.start'/)
  assert.ok(floorBranch.indexOf('placePlayers()') < floorBranch.indexOf("emitEvent('floor.start'"))
})
