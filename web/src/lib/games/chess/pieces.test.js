import test from 'node:test'
import assert from 'node:assert/strict'
import { chessPieceGlyph } from './pieces.js'

test('white pieces use solid glyphs so moved pieces stay visible', () => {
  assert.equal(chessPieceGlyph(1), '♟')
  assert.equal(chessPieceGlyph(6), '♚')
})

test('black pieces use the same solid glyph geometry', () => {
  assert.equal(chessPieceGlyph(-1), '♟')
  assert.equal(chessPieceGlyph(-6), '♚')
})
