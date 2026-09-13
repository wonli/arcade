import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ChessBoard.svelte', import.meta.url), 'utf8')

test('chess pieces use svg masks with distinct warm white and blue-black palettes', () => {
  assert.match(source, /--piece-mask/)
  assert.match(source, /-webkit-mask:/)
  assert.match(source, /\.white-piece\{[^}]*--piece-fill:#f3e7cf/i)
  assert.match(source, /\.black-piece\{[^}]*--piece-fill:#26333b/i)
  assert.doesNotMatch(source, /filter:invert\(1\)/)
  assert.doesNotMatch(source, /<img\s+class="piece"/)
})
