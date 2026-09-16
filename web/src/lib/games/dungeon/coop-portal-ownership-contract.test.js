import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./coop-portal-runtime.js', import.meta.url), 'utf8')

test('co-op portal registers a stable update owner instead of replacing Scene updatePortal', () => {
  assert.match(source, /installDungeonPortalSceneBridge/)
  assert.match(source, /ensureDungeonPortalRuntime/)
  assert.match(source, /setUpdateOwner\(/)
  assert.doesNotMatch(source, /scene\.updatePortal\s*=/)
})
