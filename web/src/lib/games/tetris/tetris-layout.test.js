import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('./TetrisBattle.svelte', import.meta.url), 'utf8')

test('tetris board is sized from viewport height instead of a large fixed width', () => {
  assert.match(source, /--tetris-board-height:/)
  assert.match(source, /calc\(100dvh\s*-\s*260px\)/)
  assert.match(source, /aspect-ratio:\s*1\s*\/\s*2/)
  assert.doesNotMatch(source, /minmax\(260px,420px\)/)
})

test('next preview stays beside the local board', () => {
  assert.match(source, /grid-template-columns:var\(--tetris-board-width\)\s+82px/)
  assert.match(source, /align-items:start/)
})

test('short viewports compact the tetris header and controls', () => {
  assert.match(source, /@media\(max-height:700px\)/)
})
