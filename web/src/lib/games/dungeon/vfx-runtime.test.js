import test from 'node:test'
import assert from 'node:assert/strict'

import { selectVfx, selectVfxVariant, vfxBlendMode, vfxCatalog } from './vfx-runtime.js'

const manifest = {
  assets: [
    { kind: 'beam', source: 'free-pixel-magic', path: '/assets/vfx/free/laser-a.png', width: 256, height: 32, frames: 8, frameWidth: 32, frameHeight: 32 },
    { kind: 'beam', source: 'free-pixel-magic', path: '/assets/vfx/free/laser-b.png', width: 128, height: 32, frames: 4, frameWidth: 32, frameHeight: 32 },
    { kind: 'beam', source: 'kenney-particles', path: '/assets/vfx/kenney/beam.png', width: 64, height: 64, frames: 1 },
    { kind: 'lightning', source: 'lightning', path: '/assets/vfx/lightning/bolt.png', width: 128, height: 32, frames: 4, frameWidth: 32, frameHeight: 32 },
    { kind: 'impact', source: 'retro-impact', path: '/assets/vfx/retro-impact/hit.png', width: 96, height: 96, frames: 1 },
    { kind: 'critical', source: 'retro-impact', path: '/assets/vfx/retro-impact/critical.png', width: 96, height: 96, frames: 1 },
    { kind: 'whirlwind', source: 'foozle', path: '/assets/vfx/foozle/tornado.png', width: 160, height: 32, frames: 5, frameWidth: 32, frameHeight: 32 },
  ],
}

test('selectVfx prefers animated purpose-specific candidates', () => {
  assert.equal(selectVfx(manifest, 'beam')?.path, '/assets/vfx/free/laser-a.png')
  assert.equal(selectVfx(manifest, 'lightning')?.source, 'lightning')
  assert.equal(selectVfx(manifest, 'missing'), null)
})

test('vfxCatalog keeps multiple ordered variants for each kind', () => {
  const catalog = vfxCatalog(manifest)
  assert.deepEqual(catalog.beam.map((asset) => asset.path), [
    '/assets/vfx/free/laser-a.png',
    '/assets/vfx/free/laser-b.png',
    '/assets/vfx/kenney/beam.png',
  ])
  assert.equal(catalog.lightning[0].path, '/assets/vfx/lightning/bolt.png')
  assert.deepEqual(catalog.explosion, [])
})

test('variant selection is stable for the same seed and can vary across seeds', () => {
  const catalog = vfxCatalog(manifest)
  assert.equal(selectVfxVariant(catalog, 'beam', 17)?.path, selectVfxVariant(catalog, 'beam', 17)?.path)
  const paths = new Set([0, 1, 2, 3, 4, 5].map((seed) => selectVfxVariant(catalog, 'beam', seed)?.path))
  assert.ok(paths.size > 1)
  assert.equal(selectVfxVariant(catalog, 'missing', 1), null)
})

test('vfx blend modes follow semantic content instead of forcing ADD', () => {
  for (const kind of ['beam', 'lightning', 'flame', 'sparkle', 'heal', 'portal', 'aura']) assert.equal(vfxBlendMode(kind), 'ADD', kind)
  for (const kind of ['slash', 'impact', 'critical', 'whirlwind', 'explosion', 'smoke']) assert.equal(vfxBlendMode(kind), 'NORMAL', kind)
})
