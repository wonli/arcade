import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./PoliceThiefBoard.svelte', import.meta.url), 'utf8')

test('police thief pieces render readable role names', () => {
  assert.match(source, /thiefLabel/)
  assert.match(source, /policeLabel/)
  assert.match(source, /thief-piece/)
  assert.match(source, /police-piece/)
})

test('police thief pieces use the committed svg assets', () => {
  assert.match(source, /game\/policethief\/assets\/p\.svg/)
  assert.match(source, /game\/policethief\/assets\/t\.svg/)
  assert.match(source, /<img[^>]+src=\{policeIcon\}/)
  assert.match(source, /<img[^>]+src=\{thiefIcon\}/)
})
