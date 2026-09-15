import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acceptRemoteInput,
  consumeRemoteInput,
  nextGuestInput,
  refreshRemoteActorVisual,
  repositionRemotePlayerForGeometryChange,
  simulateAuthoritativeRemotePlayer,
  updateMirroredDropVisuals,
} from './coop-runtime.js'

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

test('host remote player uses the same movement pickup interaction attack and skill pipeline', () => {
  const calls = []
  const player = { id: 'p2', dead: false, state: { hp: 100 } }
  const input = { moveX: 1, moveY: 0, interact: true, skill: true }
  const scene = {
    dead: false,
    runComplete: false,
    updatePlayer(dt, target, intent) { calls.push(['move', dt, target.id, intent]) },
    __dungeonPickupRuntime: { updatePlayer(target, intent) { calls.push(['pickup', target.id, intent]) } },
    __dungeonPlayerInteractions: { interactPlayer(target) { calls.push(['interact', target.id]) } },
    autoAttack(time, target) { calls.push(['attack', time, target.id]) },
    trySkill(time, target, intent) { calls.push(['skill', time, target.id, intent]) },
  }

  simulateAuthoritativeRemotePlayer(scene, player, input, 1200, 0.016)

  assert.deepEqual(calls.map((entry) => entry[0]), ['move', 'pickup', 'interact', 'attack', 'skill'])
  assert.equal(calls[0][2], 'p2')
  assert.equal(calls[2][1], 'p2')
})

test('guest mirrored drops advance the same loot animation instead of staying at the spawn apex', () => {
  let y = 28
  let scale = null
  const scene = {
    time: { now: 210 },
    drops: [{
      spawnedAt: 0,
      groundY: 100,
      y: 100,
      baseScaleX: 1,
      baseScaleY: 1,
      visual: {
        setY(next) { y = next },
        setScale(x, nextY) { scale = [x, nextY] },
      },
      glow: { setAlpha() {} },
    }],
  }

  updateMirroredDropVisuals(scene)
  assert.ok(y > 28 && y < 100)
  assert.ok(scale[0] > 0.82)
})

test('placeholder remote actor is replaced once the real player texture is ready', () => {
  let destroyed = false
  let visualUpdates = 0
  let animationSyncs = 0
  const fallback = { getData: () => false, destroy() { destroyed = true } }
  const sprite = {
    getData: () => true,
    setDepth() { return this },
    setAlpha() { return this },
  }
  const scene = {
    player: { getData: () => true },
    makeActor() { return sprite },
  }
  const runtime = {
    updatePlayerVisual() { visualUpdates++ },
    syncAnimation() { animationSyncs++ },
  }
  const player = { state: { x: 120, y: 90 }, actor: fallback, dead: false, attacking: false }

  assert.equal(refreshRemoteActorVisual(scene, runtime, player), true)
  assert.equal(player.actor, sprite)
  assert.equal(destroyed, true)
  assert.equal(visualUpdates, 1)
  assert.equal(animationSyncs, 1)
})

test('new room geometry repositions remote player before the authoritative snapshot', () => {
  let repositioned = 0
  const runtime = { repositionRemotePlayers() { repositioned++ } }

  assert.equal(repositionRemotePlayerForGeometryChange(runtime, 'room-b', 'room-a'), true)
  assert.equal(repositioned, 1)
  assert.equal(repositionRemotePlayerForGeometryChange(runtime, 'room-b', 'room-b'), false)
  assert.equal(repositioned, 1)
})
