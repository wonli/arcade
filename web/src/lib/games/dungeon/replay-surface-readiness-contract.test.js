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

test('replay surface upgrades recorded weapon drops instead of leaving generic placeholders', () => {
  assert.match(source, /import\s*\{[^}]*queueReplayWeaponArt[^}]*syncReplayGroundWeaponPresentation[^}]*\}\s*from\s*['"]\.\/replay-drop-presentation\.js['"]/)

  const syncDrops = source.match(/function\s+syncReplayDrops\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
  assert.match(syncDrops, /scene\.spawnDrop\?\.\(x,\s*y,\s*drop\.item\)/)
  assert.match(syncDrops, /syncReplayGroundWeaponPresentation\(scene,\s*spawned/)

  assert.match(source, /const\s+queuedWeaponArt\s*=\s*queueReplayWeaponArt\(scene\)/)
  assert.match(source, /queuedWeaponArt\s*>\s*0[\s\S]*?scene\.load\.once\(['"]complete['"],\s*finishAttach\)[\s\S]*?scene\.load\.start\(\)[\s\S]*?return/)

  const finishAttach = source.match(/const\s+finishAttach\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
  assert.match(finishAttach, /scene\.scene\?\.pause\?\.\(\)/)
  assert.match(finishAttach, /applyFrame\(firstFrame\)/)
})
