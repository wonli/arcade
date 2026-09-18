import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
}

const replayFiles = [
  ['gomoku', '../games/gomoku/replay.js', /GomokuReplaySurface/],
  ['chess', '../games/chess/replay.js', /ChessReplaySurface/],
  ['tetris', '../games/tetris/replay.js', /TetrisReplaySurface/],
  ['snake', '../games/snake/replay.js', /SnakeReplaySurface/],
  ['drawguess', '../games/drawguess/replay.js', /DrawReplaySurface/],
  ['dungeon', '../games/dungeon/replay.js', /DungeonReplaySurface/],
]

test('every replay uses its game-owned native surface instead of a canvas replica', () => {
  for (const [game, file, surface] of replayFiles) {
    const replay = source(file)
    assert.match(replay, surface, `${game} must mount its native replay surface`)
    assert.match(replay, /createSvelteReplayPlayer/, `${game} must use the shared native replay player`)
    assert.doesNotMatch(replay, /createCanvasReplayPlayer/, `${game} must not introduce a second canvas UI`)
  }
})

test('live gomoku, tetris, snake and drawguess reuse the same visual surfaces as replay', () => {
  assert.match(source('../routes/room/[code]/[game]/+page.svelte'), /GomokuBoard/)
  assert.match(source('../games/tetris/TetrisBattle.svelte'), /TetrisArena/)
  assert.match(source('../games/snake/SnakeArena.svelte'), /SnakeGameSurface/)
  assert.match(source('../games/drawguess/DrawGuess.svelte'), /DrawCanvasSurface/)
})

test('home replay viewport clips native game width instead of stretching it', () => {
  const preview = source('../components/GamePreview.svelte')

  assert.match(preview, /overflow:hidden/)
  assert.doesNotMatch(preview, /replay-stage :global\(canvas\)\{width:100%!important;height:100%!important/)
})
