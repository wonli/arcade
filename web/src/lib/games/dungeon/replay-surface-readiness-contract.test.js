import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const surfacePath = fileURLToPath(new URL('./DungeonReplaySurface.svelte', import.meta.url))
const scenePath = fileURLToPath(new URL('./scene.js', import.meta.url))
const surface = readFileSync(surfacePath, 'utf8')
const scene = readFileSync(scenePath, 'utf8')

test('replay surface is a thin real-scene timeline host', () => {
  assert.match(surface, /createDungeonGame\(/)
  assert.match(surface, /mode:\s*['"]replay['"]/)
  assert.match(surface, /createDungeonReplayDriver\(/)
  assert.match(surface, /driver\.play\(\)/)
  assert.doesNotMatch(surface, /createReplayEnemy|syncReplayEnemies|syncReplayPlayers|syncReplayDrops|makeActor|setFlipX|createHealthBar|ground-drop-presentation/)
})

test('replay mode waits for real Dungeon create and scene replay APIs before playback', () => {
  const attach = surface.match(/const\s+attach\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\n\s*requestAnimationFrame\(attach\)/)?.[1] ?? ''
  assert.match(attach, /scene\?\.localPlayer\?\.actor/)
  assert.match(attach, /scene\.applyReplayState/)
  assert.match(attach, /scene\.presentEvent/)
})

test('real Dungeon scene owns replay state and presentation while simulation stays disabled', () => {
  assert.match(scene, /mode\s*=\s*['"]live['"]/)
  assert.match(scene, /const\s+replayMode\s*=\s*mode\s*===\s*['"]replay['"]/)
  assert.match(scene, /this\.applyReplayState\s*=/)
  assert.match(scene, /this\.resetReplayTransient\s*=/)
  assert.match(scene, /installDungeonPresentationEvents\(this/)
  assert.match(scene, /update\(time,\s*delta\)\s*\{\s*\n\s*if\s*\(replayMode\)\s*return/)
  assert.doesNotMatch(surface, /scene\.scene\?\.pause|scene\.update\s*=/)
})
