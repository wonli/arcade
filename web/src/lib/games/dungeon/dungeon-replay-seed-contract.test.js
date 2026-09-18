import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./DungeonReplaySurface.svelte', import.meta.url), 'utf8')

test('dungeon replay pins recorded run seed before spatial map installation', () => {
  assert.match(source, /setProceduralRunSeed/)
  const firstFrame = source.indexOf('const firstFrame = $frameStore')
  const seed = source.indexOf('applyRunSeed(firstFrame)', firstFrame)
  const spatial = source.indexOf('installDungeonSpatial(scene', firstFrame)
  assert.ok(firstFrame >= 0, 'replay should read its first recorded frame')
  assert.ok(seed > firstFrame, 'replay should pin the recorded run seed')
  assert.ok(spatial > seed, 'run seed must be pinned before the spatial map is generated')
})

test('dungeon replay releases the global procedural seed on destroy', () => {
  assert.match(source, /setProceduralRunSeed\(null\)/)
})
