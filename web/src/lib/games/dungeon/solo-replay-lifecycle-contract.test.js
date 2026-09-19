import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routePath = fileURLToPath(new URL('../../../routes/dungeon/+page.svelte', import.meta.url))
const source = readFileSync(routePath, 'utf8')

test('solo Dungeon records v3 state and semantic events through the scene capture hook', () => {
  assert.match(source, /import\s*\{[^}]*captureDungeonReplayState[^}]*replay\s+as\s+dungeonReplay[^}]*\}\s*from\s*['"]\$lib\/games\/dungeon\/replay\.js['"]|import\s*\{[^}]*replay\s+as\s+dungeonReplay[^}]*captureDungeonReplayState[^}]*\}\s*from\s*['"]\$lib\/games\/dungeon\/replay\.js['"]/)
  assert.doesNotMatch(source, /createDungeonReplaySnapshot/)
  assert.match(source, /captureDungeonReplayState\(\{\s*scene:\s*dungeonScene\(\),\s*stats,\s*progress\s*\}\)/)
  assert.match(source, /function\s+recordDungeonReplayEvent\(event\)[\s\S]*?replaySession\?\.recordEvent\(event\)/)
  assert.match(source, /scene\.captureDungeonEvent\s*=\s*recordDungeonReplayEvent/)
  assert.match(source, /installDungeonReplayEventCapture\(scene\)/)
})

test('solo Dungeon finalization is promise-deduped and navigation waits for upload/release', () => {
  assert.match(source, /import\s*\{[^}]*onNavigate[^}]*\}\s*from\s*['"]\$app\/navigation['"]/) 
  assert.match(source, /let\s+replayFinishPromise\s*=\s*null/)
  assert.match(source, /if\s*\(replayFinishPromise\)\s*return\s+replayFinishPromise/)
  assert.match(source, /replayFinishPromise\s*=\s*session\.finish\(/)
  assert.match(source, /onNavigate\(\(\)\s*=>\s*\{[\s\S]*?return\s+finishDungeonReplay\(\)[\s\S]*?\}\)/)
})

test('solo restart waits for the old replay before starting a fresh recording lease', () => {
  const start = source.match(/async\s+function\s+startDungeon\(\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*onMount/)?.[1] ?? ''
  assert.match(start, /await\s+replayFinishPromise/)
  assert.match(start, /await\s+replaySession\?\.restart\?\.\(\)/)
  const waitIndex = start.indexOf('await replayFinishPromise')
  const destroyIndex = start.indexOf('previousGame?.destroy(true)')
  assert.ok(waitIndex >= 0 && destroyIndex > waitIndex, 'old final upload must finish before previous game teardown/new run')
})

test('solo teardown never destroys the replay controller ahead of a pending final upload', () => {
  assert.match(source, /if\s*\(replayFinishPromise\)[\s\S]*?replayFinishPromise\.finally\(\(\)\s*=>\s*session\.destroy\(\)\)/)
})
