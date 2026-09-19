import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./DungeonReplaySurface.svelte', import.meta.url), 'utf8')

test('dungeon replay installs the same spatial map renderer as live dungeon', () => {
  assert.match(source, /installDungeonSpatial\(scene/)
  assert.match(source, /getProgress:\s*\(\)\s*=>\s*progressFromState\(scene\.__replaySceneState\)/)
  assert.match(source, /scene\.__replaySceneState\s*=\s*structuredClone\(firstFrame\.scene/)
})
