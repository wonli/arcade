import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routePath = fileURLToPath(new URL('../../../routes/room/[code]/dungeon/+page.svelte', import.meta.url))
const source = readFileSync(routePath, 'utf8')

test('co-op replay does not start before the room is playing', () => {
  assert.match(source, /function\s+recordDungeonReplay\([^)]*\)\s*\{[\s\S]*?room\?\.status\s*!==\s*['"]playing['"][\s\S]*?return\s+false/)
})

test('co-op navigation waits for the final replay upload', () => {
  assert.match(source, /import\s*\{[^}]*onNavigate[^}]*\}\s*from\s*['"]\$app\/navigation['"]/)
  assert.match(source, /onNavigate\(\(\)\s*=>\s*\{[\s\S]*?return\s+finishDungeonReplay\(\)[\s\S]*?\}\)/)
})
