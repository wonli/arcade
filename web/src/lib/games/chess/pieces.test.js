import test from 'node:test'
import assert from 'node:assert/strict'
import { chessPieceAsset } from './pieces.js'

test('white pieces map to local SVG assets', () => {
  assert.equal(chessPieceAsset(1), '/assets/chess/pieces/pawn.svg')
  assert.equal(chessPieceAsset(4), '/assets/chess/pieces/rook.svg')
  assert.equal(chessPieceAsset(6), '/assets/chess/pieces/king.svg')
})

test('black pieces reuse the same SVG geometry', () => {
  assert.equal(chessPieceAsset(-1), '/assets/chess/pieces/pawn.svg')
  assert.equal(chessPieceAsset(-5), '/assets/chess/pieces/queen.svg')
  assert.equal(chessPieceAsset(-6), '/assets/chess/pieces/king.svg')
})
