import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./world-runtime.js', import.meta.url), 'utf8')

test('world runtime owns portal authority through PortalRuntime instead of replacing Scene openPortal', () => {
  assert.match(source, /installDungeonPortalSceneBridge/)
  assert.match(source, /ensureDungeonPortalRuntime/)
  assert.match(source, /setAuthority\(/)
  assert.doesNotMatch(source, /scene\.openPortal\s*=/)
})
