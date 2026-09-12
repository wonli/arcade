import test from 'node:test'
import assert from 'node:assert/strict'

import { comparisonCardPosition } from './comparison-runtime.js'
import { weaponComparisonModel } from './presentation.js'

test('comparison model orders build affixes before ordinary affixes', () => {
  const model = weaponComparisonModel(
    { rarity: 'rare', damage: 8, affixes: [{ id: 'life_steal', value: 0.04 }, { id: 'berserker', value: 0.3 }] },
    { rarity: 'epic', damage: 11, affixes: [{ id: 'attack_speed', value: 0.18 }, { id: 'thunder', value: 0.42 }, { id: 'power', value: 0.2 }] },
    'en',
  )
  assert.equal(model.candidate.affixes[0].id, 'thunder')
  assert.equal(model.current.affixes[0].id, 'berserker')
})

test('comparison card prefers an upper side anchor and stays inside viewport', () => {
  const viewport = { width: 960, height: 600 }
  const card = { width: 230, height: 330 }
  assert.deepEqual(comparisonCardPosition({ x: 480, y: 420 }, card, viewport), { x: 500, y: 72, side: 'right' })

  const leftEdge = comparisonCardPosition({ x: 45, y: 420 }, card, viewport)
  assert.equal(leftEdge.side, 'right')
  assert.ok(leftEdge.x >= 12)

  const rightEdge = comparisonCardPosition({ x: 925, y: 420 }, card, viewport)
  assert.equal(rightEdge.side, 'left')
  assert.ok(rightEdge.x + card.width <= viewport.width - 12)

  const topEdge = comparisonCardPosition({ x: 480, y: 70 }, card, viewport)
  assert.ok(topEdge.y >= 12)
})
