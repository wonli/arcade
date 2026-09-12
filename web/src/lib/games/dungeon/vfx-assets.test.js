import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyVfxAsset } from './vfx-assets.js'

test('classifies player-facing combat vfx by path name', () => {
  assert.equal(classifyVfxAsset('/assets/vfx/free/laser_blue.png', 256, 32).kind, 'beam')
  assert.equal(classifyVfxAsset('/assets/vfx/lightning/thunder-bolt.png', 128, 64).kind, 'lightning')
  assert.equal(classifyVfxAsset('/assets/vfx/retro/sword_slash_04.png', 96, 96).kind, 'slash')
  assert.equal(classifyVfxAsset('/assets/vfx/foozle/tornado_02.png', 128, 128).kind, 'whirlwind')
  assert.equal(classifyVfxAsset('/assets/vfx/spells/explosion_7.png', 192, 192).kind, 'explosion')
  assert.equal(classifyVfxAsset('/assets/vfx/spells/fire_flame.png', 64, 128).kind, 'flame')
  assert.equal(classifyVfxAsset('/assets/vfx/kenney/sparkle_star.png', 32, 32).kind, 'sparkle')
})

test('keeps useful dimensions and rejects unrelated pngs', () => {
  assert.deepEqual(classifyVfxAsset('/assets/vfx/free/beam_strip.png', 512, 64), {
    kind: 'beam', width: 512, height: 64, path: '/assets/vfx/free/beam_strip.png',
  })
  assert.equal(classifyVfxAsset('/assets/vfx/readme_preview.png', 800, 600), null)
})
