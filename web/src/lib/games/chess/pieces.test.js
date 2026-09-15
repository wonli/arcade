import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./pieces.js', import.meta.url), 'utf8')

test('white pieces map to the six colocated white SVG imports in chess order', () => {
  assert.match(source, /const whitePieces = \['', whitePawn, whiteKnight, whiteBishop, whiteRook, whiteQueen, whiteKing\]/)
  assert.match(source, /import whitePawn from '\.\/assets\/white\/pawn\.svg'/)
  assert.match(source, /import whiteKing from '\.\/assets\/white\/king\.svg'/)
})

test('black pieces map to the six colocated black SVG imports in chess order', () => {
  assert.match(source, /const blackPieces = \['', blackPawn, blackKnight, blackBishop, blackRook, blackQueen, blackKing\]/)
  assert.match(source, /import blackPawn from '\.\/assets\/black\/pawn\.svg'/)
  assert.match(source, /import blackKing from '\.\/assets\/black\/king\.svg'/)
  assert.match(source, /assets\[Math\.abs\(piece\)\] \?\? ''/)
})
