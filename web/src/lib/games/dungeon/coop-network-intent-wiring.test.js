import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routePath = fileURLToPath(new URL('../../../routes/room/[code]/dungeon/+page.svelte', import.meta.url))
const source = readFileSync(routePath, 'utf8')

test('co-op route forwards explicit local player intents to the network runtime', () => {
  assert.match(source, /onPlayerIntent\s*\(intent\)\s*\{/)
  assert.match(source, /networkRuntime\?\.handleLocalIntent\?\.\(intent\)/)
})
