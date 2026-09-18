import test from 'node:test'
import assert from 'node:assert/strict'
import { createRollingTimeline } from './timeline.js'

test('rolling timeline keeps only the latest window and rebases timestamps', () => {
  let now = 0
  const timeline = createRollingTimeline({ windowMs: 20_000, now: () => now })
  timeline.push({ value: 'a' })
  now = 5_000
  timeline.push({ value: 'b' })
  now = 21_000
  timeline.push({ value: 'c' })

  const recording = timeline.snapshot()
  assert.deepEqual(recording.entries.map((entry) => entry.value), ['b', 'c'])
  assert.deepEqual(recording.entries.map((entry) => entry.t), [0, 16_000])
  assert.equal(recording.durationMs, 16_000)
})

test('timeline reset starts a fresh run', () => {
  let now = 1_000
  const timeline = createRollingTimeline({ now: () => now })
  timeline.push({ value: 1 })
  timeline.reset()
  now = 2_000
  timeline.push({ value: 2 })
  assert.deepEqual(timeline.snapshot().entries, [{ t: 0, value: 2 }])
})
