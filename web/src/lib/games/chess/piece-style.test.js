import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ChessBoard.svelte', import.meta.url), 'utf8')

test('chess pieces use native black and white glyphs without svg masks', () => {
  assert.match(source, /const whitePieces = \['','♙','♘','♗','♖','♕','♔'\]/)
  assert.match(source, /const blackPieces = \['','♟','♞','♝','♜','♛','♚'\]/)
  assert.match(source, /pieceGlyph\(pieceAt\(state, cell\.x, cell\.y\)\)/)
  assert.doesNotMatch(source, /--piece-mask/)
  assert.doesNotMatch(source, /-webkit-mask:/)
  assert.doesNotMatch(source, /chessPieceAsset/)
})
