import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ChessBoard.svelte', import.meta.url), 'utf8')

test('resign uses the in-game confirmation modal instead of window.confirm', () => {
  assert.doesNotMatch(source, /window\.confirm/)
  assert.match(source, /let resignConfirmOpen = false/)
  assert.match(source, /aria-label="Confirm resignation"/)
  assert.match(source, /Opponent will win immediately\./)
  assert.match(source, />Cancel</)
  assert.match(source, />Resign</)
})
