import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
}

test('gomoku and chess replay reuse native game components instead of canvas replicas', () => {
  const gomoku = source('../games/gomoku/replay.js')
  const chess = source('../games/chess/replay.js')

  assert.match(gomoku, /GomokuReplaySurface/)
  assert.match(chess, /ChessReplaySurface/)
  assert.doesNotMatch(gomoku, /createCanvasReplayPlayer/)
  assert.doesNotMatch(chess, /createCanvasReplayPlayer/)
})

test('home replay viewport clips native game width instead of stretching it', () => {
  const preview = source('../components/GamePreview.svelte')

  assert.match(preview, /overflow:hidden/)
  assert.doesNotMatch(preview, /replay-stage :global\(canvas\)\{width:100%!important;height:100%!important/)
})
