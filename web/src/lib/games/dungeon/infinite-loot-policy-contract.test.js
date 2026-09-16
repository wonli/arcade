import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./infinite-runtime.js', import.meta.url), 'utf8')

test('infinite progression owns loot promotion through LootRuntime spawn policy instead of Scene replacement', () => {
  assert.match(source, /ensureDungeonLootRuntime/)
  assert.match(source, /setSpawnPolicy\(/)
  assert.doesNotMatch(source, /scene\.spawnDrop\s*=/)
  assert.doesNotMatch(source, /originalSpawnDrop/)
})
