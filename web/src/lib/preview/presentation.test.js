import test from 'node:test'
import assert from 'node:assert/strict'
import { previewSummaryKeys } from './presentation.js'

test('previewSummaryKeys prefers useful known fields and stays compact', () => {
  assert.deepEqual(previewSummaryKeys({ score: 1200, lines: 8, round: 2 }), [
    ['home.previewScore', { score: 1200 }],
    ['home.previewLines', { lines: 8 }],
  ])
  assert.deepEqual(previewSummaryKeys({ round: 3, moves: 24 }), [
    ['home.previewRound', { round: 3 }],
    ['home.previewMoves', { moves: 24 }],
  ])
  assert.deepEqual(previewSummaryKeys({ unknown: 1 }), [])
})
