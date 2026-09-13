import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ChessBoard.svelte', import.meta.url), 'utf8')

test('chess pieces render as two solid colors without gradients or highlight layers', () => {
  assert.match(source, /\.white-piece\{[^}]*--piece-color:#e8d2a6/i)
  assert.match(source, /\.black-piece\{[^}]*--piece-color:#314653/i)
  assert.match(source, /\.piece:after\{[^}]*background:var\(--piece-color\)/i)
  assert.doesNotMatch(source, /linear-gradient\(/)
  assert.doesNotMatch(source, /--piece-highlight:/)
  assert.doesNotMatch(source, /--piece-shade:/)
})
