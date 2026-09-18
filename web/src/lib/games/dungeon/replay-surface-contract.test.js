import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./DungeonReplaySurface.svelte', import.meta.url), 'utf8')

test('dungeon replay installs the same spatial map renderer as live dungeon', () => {
  assert.match(source, /installDungeonSpatial/)
  assert.match(source, /spatialRuntime/)
  assert.match(source, /getProgress/)
})
