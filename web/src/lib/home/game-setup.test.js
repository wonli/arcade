import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultPlayersForGame } from './game-setup.js'

test('xiangqi defaults to bot mode without changing multiplayer-only games', () => {
  assert.equal(defaultPlayersForGame('xiangqi'), 1)
  assert.equal(defaultPlayersForGame('chess'), 1)
  assert.equal(defaultPlayersForGame('dungeon'), 1)
  assert.equal(defaultPlayersForGame('policethief'), 1)
  assert.equal(defaultPlayersForGame('gomoku'), 2)
  assert.equal(defaultPlayersForGame('tetris'), 2)
  assert.equal(defaultPlayersForGame('snake'), 2)
})
