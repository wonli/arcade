import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as runtimeBundle from '../../../../../scripts/prepare-dungeon-runtime-bundle.mjs'

const bundlerPath = fileURLToPath(new URL('../../../../../scripts/prepare-dungeon-runtime-bundle.mjs', import.meta.url))
const soloPath = fileURLToPath(new URL('../../../routes/dungeon/+page.svelte', import.meta.url))
const coopPath = fileURLToPath(new URL('../../../routes/room/[code]/dungeon/+page.svelte', import.meta.url))
const replayPath = fileURLToPath(new URL('./DungeonReplaySurface.svelte', import.meta.url))
const editorPath = fileURLToPath(new URL('../../../routes/dungeon/editor/+page.svelte', import.meta.url))

function minimalDungeonManifest() {
  return {
    assets: [
      {
        source: 'dungeon-tileset',
        kind: 'trap',
        path: '/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/dragon_trap.png',
        width: 320,
        height: 512,
        frames: 1,
      },
    ],
    png: [],
  }
}

test('runtime bundle includes renderer-owned Dungeon3 textures such as dragon_trap', () => {
  const selected = runtimeBundle.selectRuntimeManifests(minimalDungeonManifest(), { assets: [] })
  assert.ok(
    selected.paths.includes('/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/dragon_trap.png'),
    'renderer texture dependencies must be part of the cached bundle',
  )
})

test('runtime bundle version changes when packaged manifest metadata changes', () => {
  assert.equal(typeof runtimeBundle.runtimeBundleVersion, 'function', 'bundler should expose one version function used by tests and main()')
  const entries = [{ path: '/assets/example.png', sha256: 'same-bytes' }]
  const first = runtimeBundle.runtimeBundleVersion(entries, { assets: [{ path: '/assets/example.png', frameWidth: 16 }] }, { assets: [] })
  const second = runtimeBundle.runtimeBundleVersion(entries, { assets: [{ path: '/assets/example.png', frameWidth: 32 }] }, { assets: [] })
  assert.notEqual(first, second, 'manifest-only changes must invalidate CacheStorage')
})

test('runtime bundle writer does not depend on a system zip executable', () => {
  const source = readFileSync(bundlerPath, 'utf8')
  assert.doesNotMatch(source, /node:child_process|execFileSync\(\s*['"]zip['"]/, 'bundle generation must stay portable across clean build hosts')
})

test('Dungeon surfaces dispose a bundle that finishes loading after teardown', () => {
  const solo = readFileSync(soloPath, 'utf8')
  const coop = readFileSync(coopPath, 'utf8')
  const replay = readFileSync(replayPath, 'utf8')
  const editor = readFileSync(editorPath, 'utf8')

  assert.match(solo, /async function loadGameResources\(\)[\s\S]*?if\s*\(!mounted\)\s*\{\s*bundle\.dispose\(\)\s*return null\s*\}/)
  assert.match(coop, /async function loadResources\(\)[\s\S]*?if\s*\(stopped\)\s*\{\s*bundle\.dispose\(\)\s*return null\s*\}/)
  assert.match(replay, /if\s*\(!mount\s*\|\|\s*stopped\)\s*\{\s*bundle\.dispose\(\)\s*return\s*\}/)
  assert.match(editor, /if\s*\(!mounted\)\s*\{\s*loaded\.dispose\(\)\s*return\s*\}/)
})
