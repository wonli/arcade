import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDungeonReplayRecorder,
  encodeDungeonRecording,
  decodeDungeonRecording,
} from './replay-recording.js'

test('events at the same timestamp retain insertion order through seq', () => {
  let now = 1_000
  const recorder = createDungeonReplayRecorder({ now: () => now })
  recorder.record({ players: [{ id: 'p1', x: 10, y: 20 }] }, now, { force: true })
  recorder.recordEvent({ type: 'hit', targetId: 'e1' }, now + 20)
  recorder.recordEvent({ type: 'death', entityId: 'e1' }, now + 20)
  const result = recorder.snapshot()
  assert.deepEqual(result.events.map((event) => [event.t, event.seq, event.type]), [
    [20, 0, 'hit'],
    [20, 1, 'death'],
  ])
})

test('state deduplication never deduplicates semantic events', () => {
  let now = 0
  const recorder = createDungeonReplayRecorder({ now: () => now, minIntervalMs: 160 })
  assert.equal(recorder.record({ players: [{ id: 'p1', x: 1, y: 2 }] }, now, { force: true }), true)
  now = 200
  assert.equal(recorder.record({ players: [{ id: 'p1', x: 1, y: 2 }] }, now), false)
  recorder.recordEvent({ type: 'player.attack', playerId: 'p1' }, now)
  recorder.recordEvent({ type: 'player.attack', playerId: 'p1' }, now)
  assert.equal(recorder.snapshot().events.length, 2)
})

test('rolling window prunes frames and events together', () => {
  const recorder = createDungeonReplayRecorder({ windowMs: 1_000, minIntervalMs: 0 })
  recorder.record({ value: 1 }, 0, { force: true })
  recorder.recordEvent({ type: 'hit', targetId: 'old' }, 100)
  recorder.record({ value: 2 }, 900, { force: true })
  recorder.recordEvent({ type: 'hit', targetId: 'keep' }, 950)
  recorder.record({ value: 3 }, 1_800, { force: true })
  const snapshot = recorder.snapshot()
  assert.equal(snapshot.frames[0].state.value, 2)
  assert.equal(snapshot.frames[0].t, 0)
  assert.deepEqual(snapshot.events.map((event) => event.targetId), ['keep'])
  assert.equal(snapshot.events[0].t, 50)
})

test('encoding compacts a busy recording under the payload ceiling', () => {
  const recorder = createDungeonReplayRecorder({ windowMs: 120_000, minIntervalMs: 0 })
  for (let index = 0; index < 900; index++) {
    const at = index * 50
    recorder.record({
      players: [{ id: 'p1', x: index, y: index + 1 }],
      padding: `frame-${index}-` + 'x'.repeat(120),
    }, at, { force: true })
    recorder.recordEvent({ type: 'hit', targetId: `e-${index}`, note: 'y'.repeat(20) }, at + 1)
  }
  const bytes = encodeDungeonRecording(recorder.snapshot(), { maxBytes: 100 << 10 })
  assert.ok(bytes.byteLength <= (100 << 10))
  const decoded = decodeDungeonRecording(bytes)
  assert.equal(decoded.frames[0].t, 0)
  assert.ok(decoded.events.every((event) => event.t >= 0))
  assert.ok(decoded.frames.length >= 1)
})

test('decode rejects malformed recordings and recordings without frames', () => {
  assert.throws(() => decodeDungeonRecording(new TextEncoder().encode('{broken')), /JSON|Unexpected/)
  assert.throws(() => decodeDungeonRecording(new TextEncoder().encode(JSON.stringify({ version: 3, frames: [] }))), /no frames/)
})

test('reset clears both timelines and restarts event sequence', () => {
  const recorder = createDungeonReplayRecorder()
  recorder.record({ value: 1 }, 10, { force: true })
  recorder.recordEvent({ type: 'hit' }, 20)
  recorder.reset()
  recorder.record({ value: 2 }, 30, { force: true })
  recorder.recordEvent({ type: 'hit' }, 31)
  const snapshot = recorder.snapshot()
  assert.equal(snapshot.frames.length, 1)
  assert.equal(snapshot.events[0].seq, 0)
})
