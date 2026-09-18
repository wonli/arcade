import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const replaySource = fs.readFileSync(`${here}/replay.js`, 'utf8')
const liveSource = fs.readFileSync(`${here}/TetrisBattle.svelte`, 'utf8')

test('tetris live and replay share the same arena component', () => {
  assert.match(replaySource, /TetrisReplaySurface/)
  assert.doesNotMatch(replaySource, /createCanvasReplayPlayer|drawState\s*\(/)
  assert.match(liveSource, /TetrisArena/)
})
