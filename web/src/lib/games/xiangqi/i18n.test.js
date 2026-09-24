import test from 'node:test'
import assert from 'node:assert/strict'
import { createXiangqiTranslator } from './i18n.js'

test('xiangqi copy resolves in English and Chinese and falls back to shared copy', () => {
  const en = createXiangqiTranslator('en', (key) => `shared:${key}`)
  const zh = createXiangqiTranslator('zh-CN', (key) => `shared:${key}`)

  assert.equal(en('game.xiangqi.name'), 'Chinese Chess')
  assert.equal(zh('game.xiangqi.name'), '中国象棋')
  assert.equal(en('create.xiangqiBot'), 'Play Chinese Chess vs Bot')
  assert.equal(zh('helper.xiangqiBot'), '你执红先行，机器人执黑。')
  assert.equal(en('xiangqi.opponentTimedOut'), 'Opponent ran out of time')
  assert.equal(zh('xiangqi.youTimedOut'), '你超时未走棋')
  assert.equal(en('room.yourTurn'), 'shared:room.yourTurn')
})
