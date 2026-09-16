import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerIntentRuntime } from './player-intent-runtime.js'
import { createPlayerEntity, getPlayerSkillReadyAt, setPlayerSkillReadyAt } from './player-entity.js'

function player() {
  return createPlayerEntity({
    id: 'guest',
    state: { x: 0, y: 0, hp: 100, maxHp: 100, equipment: { weapon: null }, modifiers: {} },
  })
}

test('successful local attack emits exactly one semantic attack intent', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  const result = runtime.attack(1200, () => {
    localPlayer.lastAttackAt = 1200
    return 'hit'
  })

  assert.equal(result, 'hit')
  assert.deepEqual(intents, [{ type: 'attack', playerId: 'guest', time: 1200 }])
})

test('declined local attack emits no network intent', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  runtime.attack(900, () => undefined)

  assert.deepEqual(intents, [])
})

test('successful local skill emits one semantic skill intent only when cooldown advances', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  runtime.skill(1500, 'primary', () => {
    setPlayerSkillReadyAt(localPlayer, 'primary', 5000)
    return { cast: true }
  })

  assert.equal(getPlayerSkillReadyAt(localPlayer, 'primary'), 5000)
  assert.deepEqual(intents, [{ type: 'skill', playerId: 'guest', skillId: 'primary', time: 1500 }])
})

test('declined local skill emits no intent when cooldown does not advance', () => {
  const localPlayer = player()
  const intents = []
  const runtime = createPlayerIntentRuntime({ player: localPlayer, emit: (intent) => intents.push(intent) })

  runtime.skill(1500, 'primary', () => ({ cast: false }))

  assert.deepEqual(intents, [])
})
