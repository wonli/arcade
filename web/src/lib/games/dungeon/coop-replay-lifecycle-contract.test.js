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

test('co-op navigation waits for the final replay upload', () => {
  assert.match(source, /import\s*\{[^}]*onNavigate[^}]*\}\s*from\s*['"]\$app\/navigation['"]/) 
  assert.match(source, /onNavigate\(\(\)\s*=>\s*\{[\s\S]*?return\s+finishDungeonReplay\(\)[\s\S]*?\}\)/)
})
