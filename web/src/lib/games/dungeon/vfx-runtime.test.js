import test from 'node:test'
import assert from 'node:assert/strict'

import { selectVfx, vfxCatalog } from './vfx-runtime.js'

const manifest = {
  assets: [
    { kind: 'beam', source: 'free-pixel-magic', path: '/assets/vfx/free/laser.png', width: 256, height: 32, frames: 8, frameWidth: 32, frameHeight: 32 },
    { kind: 'beam', source: 'kenney-particles', path: '/assets/vfx/kenney/beam.png', width: 64, height: 64, frames: 1 },
    { kind: 'lightning', source: 'lightning', path: '/assets/vfx/lightning/bolt.png', width: 128, height: 32, frames: 4, frameWidth: 32, frameHeight: 32 },
    { kind: 'whirlwind', source: 'foozle', path: '/assets/vfx/foozle/tornado.png', width: 160, height: 32, frames: 5, frameWidth: 32, frameHeight: 32 },
  ],
}

test('selectVfx prefers animated purpose-specific candidates', () => {
  assert.equal(selectVfx(manifest, 'beam')?.source, 'free-pixel-magic')
  assert.equal(selectVfx(manifest, 'lightning')?.source, 'lightning')
  assert.equal(selectVfx(manifest, 'missing'), null)
})

test('vfxCatalog produces stable one-per-kind runtime selections', () => {
  const catalog = vfxCatalog(manifest)
  assert.equal(catalog.beam.path, '/assets/vfx/free/laser.png')
  assert.equal(catalog.lightning.path, '/assets/vfx/lightning/bolt.png')
  assert.equal(catalog.whirlwind.path, '/assets/vfx/foozle/tornado.png')
  assert.equal(catalog.explosion, null)
})
