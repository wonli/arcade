import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const boardSource = readFileSync(new URL('./XiangqiBoard.svelte', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../../../routes/room/[code]/xiangqi/+page.svelte', import.meta.url), 'utf8')

test('xiangqi board template keeps state as an explicit reactive dependency', () => {
  assert.match(boardSource, /pieceAt\(state,\s*point\.x,\s*point\.y\)/)
  assert.match(boardSource, /legalTo\(state,\s*point\.x,\s*point\.y\)/)
  assert.match(boardSource, /isLastPoint\(state,\s*point\.x,\s*point\.y\)/)
  assert.match(boardSource, /isCheckedGeneral\(state,\s*piece\)/)
})

test('xiangqi page no longer relies on optimistic board mutation or polling', () => {
  assert.doesNotMatch(pageSource, /optimisticXiangqiMove/)
  assert.doesNotMatch(pageSource, /requestRoomState/)
  assert.doesNotMatch(pageSource, /scheduleBotSync/)
})
