import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const battleSource = await readFile(new URL('./TetrisBattle.svelte', import.meta.url), 'utf8')
const arenaSource = await readFile(new URL('./TetrisArena.svelte', import.meta.url), 'utf8')

test('tetris board is sized from viewport height instead of a large fixed width', () => {
  assert.match(arenaSource, /--tetris-board-height:/)
  assert.match(arenaSource, /calc\(100dvh\s*-\s*260px\)/)
  assert.match(arenaSource, /aspect-ratio:\s*1\s*\/\s*2/)
  assert.doesNotMatch(arenaSource, /minmax\(260px,420px\)/)
})

test('next preview stays beside the local board', () => {
  assert.match(arenaSource, /grid-template-columns:var\(--tetris-board-width\)\s+82px/)
  assert.match(arenaSource, /align-items:start/)
})

test('short viewports compact the tetris header and controls', () => {
  assert.match(battleSource, /@media\(max-height:700px\)/)
})
