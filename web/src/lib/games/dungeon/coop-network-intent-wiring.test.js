import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routePath = fileURLToPath(new URL('../../../routes/room/[code]/dungeon/+page.svelte', import.meta.url))
const source = readFileSync(routePath, 'utf8')

test('co-op route forwards explicit local player intents to the network runtime', () => {
  assert.match(source, /import\s*\{\s*installPlayerIntentRuntime\s*\}\s*from\s*['"]\$lib\/games\/dungeon\/player-intent-runtime\.js['"]/)
  assert.match(source, /playerIntentRuntime\s*=\s*installPlayerIntentRuntime\(scene,\s*\{/)
  assert.match(source, /onIntent\(intent\)\s*\{\s*networkRuntime\?\.handleLocalIntent\?\.\(intent\)\s*\}/s)
  assert.match(source, /playerIntentRuntime\?\.restore\?\.\(\)/)
})
