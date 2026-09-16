import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./pickup-runtime.js', import.meta.url)), 'utf8')

test('pickup runtime registers LootRuntime owners instead of replacing Scene loot methods', () => {
  assert.doesNotMatch(source, /scene\.spawnDrop\s*=/)
  assert.doesNotMatch(source, /scene\.destroyDrop\s*=/)
  assert.doesNotMatch(source, /scene\.clearDrops\s*=/)
  assert.doesNotMatch(source, /scene\.updateDrops\s*=/)
  assert.doesNotMatch(source, /scene\.emitStats\s*=/)

  assert.match(source, /installDungeonLootSceneBridge\(scene\)/)
  assert.match(source, /ensureDungeonLootRuntime\(scene\)/)
  assert.match(source, /loot\.setSpawnOwner\(/)
  assert.match(source, /loot\.setRemoveOwner\(/)
  assert.match(source, /loot\.setClearOwner\(/)
  assert.match(source, /loot\.setStepOwner\(/)
})
