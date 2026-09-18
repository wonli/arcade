import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const replaySource = fs.readFileSync(`${here}/replay.js`, 'utf8')
const liveSource = fs.readFileSync(`${here}/SnakeArena.svelte`, 'utf8')

test('snake live and replay share the same game surface', () => {
  assert.match(replaySource, /SnakeReplaySurface/)
  assert.doesNotMatch(replaySource, /createCanvasReplayPlayer|drawState\s*\(/)
  assert.match(liveSource, /SnakeGameSurface/)
})
