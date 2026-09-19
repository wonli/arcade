import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function source(relative) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

const surface = source('./DungeonReplaySurface.svelte')
const replay = source('./replay.js')
const scene = source('./scene.js')
const stack = source('./presentation-stack.js')
const soloRoute = source('../../../routes/dungeon/+page.svelte')
const coopRoute = source('../../../routes/room/[code]/dungeon/+page.svelte')

test('ReplaySurface is only a lifecycle shell around the real replay-mode DungeonScene', () => {
  assert.match(surface, /createDungeonGame/)
  assert.match(surface, /mode:\s*['"]replay['"]/)
  assert.match(surface, /installDungeonPresentationStack\(scene,\s*\{\s*vfxManifest\s*\}\)/)
  assert.match(surface, /createDungeonReplayDriver\(\{\s*recording,\s*scene,\s*loop:\s*true\s*\}\)/)

  for (const forbidden of [
    'createReplayEnemy', 'syncReplayEnemies', 'syncReplayPlayers', 'syncReplayDrops',
    'spawnRemotePlayer', 'despawnRemotePlayer', 'setFlipX', 'createHealthBar',
    'syncGroundDropPresentation', 'updateGroundDropPresentation', 'installDungeonSpatial',
  ]) {
    assert.equal(surface.includes(forbidden), false, `ReplaySurface must not own ${forbidden}`)
  }
})

test('real DungeonScene owns replay state materialization and semantic presentation', () => {
  assert.match(scene, /this\.applyReplayState\s*=\s*\(state\)\s*=>\s*this\.__dungeonReplayMaterializer\.apply\(state\)/)
  assert.match(scene, /installDungeonPresentationEvents\(this,\s*\{\s*onEvent\s*\}\)/)
  assert.match(scene, /if\s*\(!replayMode\)\s*this\.startFloor\(true,/)
  assert.doesNotMatch(scene, /scene\.pause\(\)|this\.scene\.pause\(\)/)
})

test('shared presentation stack owns durable Dungeon visuals including ground drops and projectiles', () => {
  assert.match(stack, /installGroundDropPresentationRuntime/)
  assert.match(stack, /installDungeonProjectilePresentation/)
  assert.match(stack, /installDungeonWeaponVisuals/)
  assert.match(stack, /installEnemyPresentationRuntime/)
  assert.match(stack, /installPortalPresentationRuntime/)
})

test('Dungeon routes record only v3 semantic state API and no v2 snapshot alias remains', () => {
  assert.doesNotMatch(replay, /createDungeonReplaySnapshot/)
  assert.doesNotMatch(soloRoute, /createDungeonReplaySnapshot/)
  assert.doesNotMatch(coopRoute, /createDungeonReplaySnapshot/)
  assert.match(soloRoute, /captureDungeonReplayState/)
  assert.match(coopRoute, /captureDungeonReplayState/)
})
