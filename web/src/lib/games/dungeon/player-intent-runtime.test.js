import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerIntentRuntime, installPlayerIntentRuntime } from './player-intent-runtime.js'
import { createPlayerEntity, setPlayerSkillReadyAt } from './player-entity.js'

function player() {
  return createPlayerEntity({
    id: 'guest',
    state: { x: 0, y: 0, hp: 100, maxHp: 100, equipment: { weapon: null }, modifiers: {} },
  })
}

test('observer emits one semantic attack intent when local attack state advances', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  localPlayer.lastAttackAt = 1200
  runtime.observe(1200)
  runtime.observe(1200)

  assert.deepEqual(intents, [{ type: 'attack', playerId: 'guest', time: 1200 }])
})

test('observer emits no attack intent when gameplay declined the attack', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  runtime.observe(900)

  assert.deepEqual(intents, [])
})

test('observer emits one semantic skill intent when local primary cooldown advances', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  setPlayerSkillReadyAt(localPlayer, 'primary', 5000)
  runtime.observe(1500)
  runtime.observe(1500)

  assert.deepEqual(intents, [{ type: 'skill', playerId: 'guest', skillId: 'primary', time: 1500 }])
})

test('installed intent runtime observes postupdate without replacing gameplay methods', () => {
  const localPlayer = player()
  const listeners = new Map()
  const scene = {
    localPlayer,
    time: { now: 1000 },
    events: {
      on(name, listener) { listeners.set(name, listener) },
      off(name, listener) { if (listeners.get(name) === listener) listeners.delete(name) },
    },
  }
  const intents = []
  const runtime = installPlayerIntentRuntime(scene, { player: localPlayer, onIntent: (intent) => intents.push(intent) })

  localPlayer.lastAttackAt = 1400
  scene.time.now = 1400
  listeners.get('postupdate')?.()

  assert.deepEqual(intents, [{ type: 'attack', playerId: 'guest', time: 1400 }])
  runtime.restore()
  assert.equal(listeners.has('postupdate'), false)
})
