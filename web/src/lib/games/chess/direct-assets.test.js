import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pieces = readFileSync(new URL('./pieces.js', import.meta.url), 'utf8')
const makefile = readFileSync(new URL('../../../../../Makefile', import.meta.url), 'utf8')

test('chess pieces are imported from source assets instead of static output', () => {
  assert.match(pieces, /assets\/chess\/pieces\/pawn\.svg/)
  assert.match(pieces, /import pawn/)
  assert.doesNotMatch(pieces, /['"`]\/assets\/chess\/pieces\//)
  assert.doesNotMatch(makefile, /chess-assets/)
  assert.doesNotMatch(makefile, /prepare-chess-assets/)
})
