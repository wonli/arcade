import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routePath = fileURLToPath(new URL('../../../routes/room/[code]/dungeon/+page.svelte', import.meta.url))
const source = readFileSync(routePath, 'utf8')

test('dungeon replay starts when the local scene is ready even before a peer joins', () => {
  const recordFunction = source.match(/function\s+recordDungeonReplay\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
  assert.doesNotMatch(recordFunction, /room\?\.status\s*!==\s*['"]playing['"]|room\.status\s*!==\s*['"]playing['"]/) 
  assert.match(source, /ready\s*=\s*true[\s\S]*?ensureNetwork\(\)[\s\S]*?recordDungeonReplay\(true\)/)
})

test('dungeon replay keeps sampling while the optional co-op peer is absent', () => {
  const timerBlock = source.match(/replayTimer\s*=\s*setInterval\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*200\)/)?.[1] ?? ''
  assert.match(timerBlock, /ready\s*&&\s*!replayFinished[\s\S]*?recordDungeonReplay\(\)/)
  assert.doesNotMatch(timerBlock, /room\?*\.status|['"]playing['"]/) 
})

test('co-op Dungeon records v3 state and semantic events without a playing-room gate', () => {
  assert.match(source, /captureDungeonReplayState\(\{\s*scene,\s*stats,\s*progress\s*\}\)/)
  assert.doesNotMatch(source, /createDungeonReplaySnapshot/)
  assert.match(source, /function\s+recordDungeonReplayEvent\(event\)[\s\S]*?replaySession\?\.recordEvent\(event\)/)
  assert.match(source, /scene\.captureDungeonEvent\s*=\s*recordDungeonReplayEvent/)
  assert.match(source, /installDungeonReplayEventCapture\(scene\)/)

  const subscription = source.match(/function\s+subscribeRoomState\(\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*async\s+function\s+startGame/)?.[1] ?? ''
  assert.match(subscription, /recordDungeonReplay\(true\)/)
  assert.doesNotMatch(subscription, /room\.status\s*===\s*['"]playing['"]/)
})

test('co-op navigation waits for the final replay upload', () => {
  assert.match(source, /import\s*\{[^}]*onNavigate[^}]*\}\s*from\s*['"]\$app\/navigation['"]/) 
  assert.match(source, /onNavigate\(\(\)\s*=>\s*\{[\s\S]*?return\s+finishDungeonReplay\(\)[\s\S]*?\}\)/)
})

test('co-op teardown preserves pending finalization before destroying the session', () => {
  assert.match(source, /if\s*\(replayFinishPromise\)[\s\S]*?replayFinishPromise\.finally\(\(\)\s*=>\s*session\.destroy\(\)\)/)
})
