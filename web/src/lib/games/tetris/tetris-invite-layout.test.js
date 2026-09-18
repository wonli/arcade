import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const battle = readFileSync(new URL('./TetrisBattle.svelte', import.meta.url), 'utf8')
const roomPage = readFileSync(new URL('../../../routes/room/[code]/[game]/+page.svelte', import.meta.url), 'utf8')

test('tetris keeps multiplayer room code and invite action in its title tools', () => {
  assert.match(battle, /class="invite-tools"/)
  assert.match(battle, /copyInvite/)
  assert.match(battle, /common\.copyInvite/)
})

test('room page no longer renders a separate tetris invite panel below the game', () => {
  assert.doesNotMatch(roomPage, /tetris-panel/)
})
