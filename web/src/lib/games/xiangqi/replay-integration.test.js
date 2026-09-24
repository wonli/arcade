import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const registrySource = readFileSync(new URL('../registry.js', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../../../routes/room/[code]/xiangqi/+page.svelte', import.meta.url), 'utf8')

test('xiangqi is registered with a replay adapter', () => {
  assert.match(registrySource, /import\s+\{\s*replay\s+as\s+xiangqiReplay\s*\}\s+from\s+'\.\/xiangqi\/replay\.js'/)
  assert.match(registrySource, /id:\s*'xiangqi',\s*launcher:\s*xiangqiLauncher,\s*replay:\s*xiangqiReplay/)
})

test('xiangqi room records and finishes replay sessions', () => {
  assert.match(pageSource, /createReplaySession/)
  assert.match(pageSource, /replaySession\?\.record\(gameState\)/)
  assert.match(pageSource, /replaySession\?\.finish\(gameState\)/)
  assert.match(pageSource, /replaySession\?\.destroy\(\)/)
})
