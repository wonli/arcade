import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./pickup-runtime.js', import.meta.url)), 'utf8')
const assignment = (name) => new RegExp(`scene\\.${name}\\s*=(?!=)`)

test('pickup runtime registers LootRuntime owners instead of replacing Scene loot methods', () => {
  assert.doesNotMatch(source, assignment('spawnDrop'))
  assert.doesNotMatch(source, assignment('destroyDrop'))
  assert.doesNotMatch(source, assignment('clearDrops'))
  assert.doesNotMatch(source, assignment('updateDrops'))
  assert.doesNotMatch(source, assignment('emitStats'))

  assert.match(source, /installDungeonLootSceneBridge\(scene\)/)
  assert.match(source, /ensureDungeonLootRuntime\(scene\)/)
  assert.match(source, /loot\.setSpawnOwner\(/)
  assert.match(source, /loot\.setRemoveOwner\(/)
  assert.match(source, /loot\.setClearOwner\(/)
  assert.match(source, /loot\.setStepOwner\(/)
})
