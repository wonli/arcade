import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const surfacePath = fileURLToPath(new URL('./DungeonReplaySurface.svelte', import.meta.url))
const source = readFileSync(surfacePath, 'utf8')

test('replay surface waits for Dungeon create before replacing live artifacts', () => {
  const attach = source.match(/const\s+attach\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\n\s*requestAnimationFrame\(attach\)/)?.[1] ?? ''
  assert.match(attach, /scene\?\.localPlayer\?\.actor/)

  const readyIndex = attach.search(/scene\?\.localPlayer\?\.actor/)
  const clearIndex = attach.indexOf('clearLiveArtifacts()')
  const applyIndex = attach.indexOf('applyFrame(firstFrame)')
  assert.ok(readyIndex >= 0 && clearIndex > readyIndex, 'scene readiness must be checked before clearing live artifacts')
  assert.ok(applyIndex > clearIndex, 'the replay frame must be applied only after live artifacts are cleared')
})

test('replay surface uses the same ground-drop presentation as live gameplay', () => {
  assert.match(source, /import\s*\{[^}]*queueGroundDropArt[^}]*syncGroundDropPresentation[^}]*updateGroundDropPresentation[^}]*\}\s*from\s*['"]\.\/ground-drop-presentation\.js['"]/)
  assert.doesNotMatch(source, /replay-drop-presentation\.js/)

  const syncDrops = source.match(/function\s+syncReplayDrops\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
  assert.match(syncDrops, /scene\.spawnDrop\?\.\(x,\s*y,\s*drop\.item\)/)
  assert.match(syncDrops, /syncGroundDropPresentation\(scene,\s*spawned/)

  assert.match(source, /const\s+queuedDropArt\s*=\s*queueGroundDropArt\(scene\)/)
  assert.match(source, /queuedDropArt\s*>\s*0[\s\S]*?scene\.load\.once\(['"]complete['"],\s*finishAttach\)[\s\S]*?scene\.load\.start\(\)[\s\S]*?return/)
})

test('replay keeps Phaser presentation time alive while gameplay update is disabled', () => {
  assert.doesNotMatch(source, /scene\.scene\?\.pause\?\.\(\)/)
  assert.match(source, /scene\.update\s*=\s*\(time\)\s*=>\s*\{/)
  assert.match(source, /updateGroundDropPresentation\(scene,\s*drop,\s*time\)/)
})