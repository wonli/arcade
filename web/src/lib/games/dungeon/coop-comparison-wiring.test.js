import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routeSource = readFileSync(
  new URL('../../../routes/room/[code]/dungeon/+page.svelte', import.meta.url),
  'utf8',
)

test('co-op route installs the shared weapon comparison card and feeds local pickup selection into it', () => {
  assert.match(routeSource, /createComparisonCard/)
  assert.match(routeSource, /scene\.__comparisonCard\s*=\s*createComparisonCard/)
  assert.match(routeSource, /onSelection\(next\)\s*\{\s*scene\.__comparisonCard\?\.setSelection\(next\)/s)
})

test('co-op locale changes refresh comparison labels', () => {
  assert.match(routeSource, /scene\?\.__comparisonCard\?\.refresh\?\.\(\)/)
})
