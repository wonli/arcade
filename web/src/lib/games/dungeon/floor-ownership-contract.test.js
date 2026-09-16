import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const infinite = readFileSync(new URL('./infinite-runtime.js', import.meta.url), 'utf8')
const backtrack = readFileSync(new URL('./backtrack-runtime.js', import.meta.url), 'utf8')
const world = readFileSync(new URL('./world-runtime.js', import.meta.url), 'utf8')

test('infinite progression registers the floor advance owner instead of replacing Scene advanceFloor', () => {
  assert.match(infinite, /installDungeonFloorSceneBridge/)
  assert.match(infinite, /ensureDungeonFloorRuntime/)
  assert.match(infinite, /setAdvanceOwner\(/)
  assert.doesNotMatch(infinite, /scene\.advanceFloor\s*=/)
})

test('backtracking registers a floor transition policy instead of wrapping Scene advanceFloor', () => {
  assert.match(backtrack, /installDungeonFloorSceneBridge/)
  assert.match(backtrack, /ensureDungeonFloorRuntime/)
  assert.match(backtrack, /setTransitionPolicy\(/)
  assert.doesNotMatch(backtrack, /scene\.advanceFloor\s*=/)
  assert.doesNotMatch(backtrack, /originalAdvanceFloor/)
})

test('world runtime owns floor authority without replacing Scene advanceFloor', () => {
  assert.match(world, /installDungeonFloorSceneBridge/)
  assert.match(world, /ensureDungeonFloorRuntime/)
  assert.doesNotMatch(world, /scene\.advanceFloor\s*=/)
  assert.doesNotMatch(world, /originals\.advanceFloor/)
})
