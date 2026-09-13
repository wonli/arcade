import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ChessBoard.svelte', import.meta.url), 'utf8')

test('chess pieces render svg assets without css recoloring', () => {
  assert.match(source, /import \{ chessPieceAsset \} from '\.\/pieces\.js'/)
  assert.match(source, /<img class="piece"/)
  assert.match(source, /src=\{chessPieceAsset\(pieceAt\(state, cell\.x, cell\.y\)\)\}/)
  assert.doesNotMatch(source, /filter:invert/)
  assert.doesNotMatch(source, /--piece-mask/)
  assert.doesNotMatch(source, /♙|♟|♘|♞/)
})
