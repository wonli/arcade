import test from 'node:test'
import assert from 'node:assert/strict'
import { replay } from './replay.js'

test('draw replay preserves strokes but never serializes private words or guesses', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({
    round: 2,
    strokes: [{ color: '#111111', width: 6, eraser: false, points: [{ x: .1, y: .2 }, { x: .3, y: .4 }] }],
    word: 'secret-word',
    guesses: ['secret-word'],
  })
  const bytes = replay.encode(recorder.snapshot())
  const text = new TextDecoder().decode(bytes)
  assert.equal(text.includes('secret-word'), false)
  const decoded = replay.decode(bytes)
  assert.equal(decoded.frames[0].state.strokes.length, 1)
  assert.equal(decoded.frames[0].state.round, 2)
})
