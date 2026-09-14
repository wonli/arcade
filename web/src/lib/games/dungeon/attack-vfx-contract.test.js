import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(name) {
  return readFile(new URL(`./${name}`, import.meta.url), 'utf8')
}

const PROCEDURAL_GEOMETRY = /\.add(?:\?\.|\.)(rectangle|circle|arc|graphics)(?:\?\.)?\(/

test('combat attack runtimes never use procedural Phaser geometry as VFX fallback', async () => {
  const [attackRuntime, vfxRuntime, projectileRuntime] = await Promise.all([
    source('attack-runtime.js'),
    source('vfx-runtime.js'),
    source('weapon-projectile-runtime.js'),
  ])

  assert.doesNotMatch(attackRuntime, /\beffectLine\s*\(/)
  assert.doesNotMatch(vfxRuntime, PROCEDURAL_GEOMETRY)
  assert.doesNotMatch(projectileRuntime, PROCEDURAL_GEOMETRY)
})
