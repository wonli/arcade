import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pieces = readFileSync(new URL('./pieces.js', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../../../../vite.config.js', import.meta.url), 'utf8')

test('chess pieces use colocated black and white svg assets', () => {
  assert.match(pieces, /\.\/assets\/white\/pawn\.svg/)
  assert.match(pieces, /\.\/assets\/black\/pawn\.svg/)
  assert.match(pieces, /piece > 0 \? whitePieces/)
  assert.doesNotMatch(pieces, /\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/chess\/pieces/)
  assert.doesNotMatch(vite, /fs:\s*\{\s*allow:/)
})
