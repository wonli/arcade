import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8')

test('chess page exposes resign and finished modal controls', () => {
  assert.match(source, /game\.resign/)
  assert.match(source, /class="chess-result-modal"/)
  assert.match(source, /Resign/)
  assert.match(source, /Play again/)
})
