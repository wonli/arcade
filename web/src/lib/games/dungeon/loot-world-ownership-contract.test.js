import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./world-runtime.js', import.meta.url)), 'utf8')

test('world runtime owns loot authority through LootRuntime instead of replacing Scene loot methods', () => {
  assert.doesNotMatch(source, /scene\.spawnDrop\s*=\s*function/)
  assert.doesNotMatch(source, /scene\.destroyDrop\s*=\s*function/)
  assert.doesNotMatch(source, /scene\.clearDrops\s*=\s*function/)
  assert.doesNotMatch(source, /scene\.updateDrops\s*=\s*function/)
  assert.doesNotMatch(source, /__dungeonPickupRuntime/)

  assert.match(source, /ensureDungeonLootRuntime\(scene\)/)
  assert.match(source, /loot\.setAuthority\(/)
  assert.match(source, /loot\.setPickupOwner\(/)
  assert.match(source, /loot\.spawnExact\(/)
})
