import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./PoliceThiefBoard.svelte', import.meta.url), 'utf8')

test('police thief pieces render readable role names', () => {
  assert.match(source, /thiefLabel/)
  assert.match(source, /policeLabel/)
  assert.match(source, /thief-piece[^>]*>\{thiefLabel\}</)
  assert.match(source, /police-piece[^>]*>\{policeLabel\}</)
})
