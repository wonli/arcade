import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./coop-lifecycle-runtime.js', import.meta.url), 'utf8')

test('co-op lifecycle registers stable capability owners instead of replacing Scene methods', () => {
  assert.match(source, /installDungeonPlayerLifecycleSceneBridge/)
  assert.match(source, /ensureDungeonPlayerLifecycleRuntime/)
  assert.match(source, /setHitOwner\(/)
  assert.match(source, /setGameOverOwner\(/)
  assert.doesNotMatch(source, /scene\.hitPlayer\s*=/)
  assert.doesNotMatch(source, /scene\.gameOver\s*=/)
})
