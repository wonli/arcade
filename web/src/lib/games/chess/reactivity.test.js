import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ChessBoard.svelte', import.meta.url), 'utf8')

test('chess board template keeps server state as an explicit reactive dependency', () => {
  assert.match(source, /pieceAt\(state,\s*cell\.x,\s*cell\.y\)/)
  assert.match(source, /isLegalTarget\(state,\s*cell\.x,\s*cell\.y\)/)
  assert.match(source, /isLastSquare\(state,\s*cell\.x,\s*cell\.y\)/)
  assert.doesNotMatch(source, /pieceAt\(cell\.x,\s*cell\.y\)/)
  assert.doesNotMatch(source, /isLegalTarget\(cell\.x,\s*cell\.y\)/)
})
