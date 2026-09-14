import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyVfxAsset } from './vfx-assets.js'

test('classifies the full dungeon vfx taxonomy by semantic path name', () => {
  const cases = [
    ['/assets/vfx/free/laser_blue.png', 'beam'],
    ['/assets/vfx/lightning/thunder-bolt.png', 'lightning'],
    ['/assets/vfx/retro/sword_slash_04.png', 'slash'],
    ['/assets/vfx/retro/hit_impact_04.png', 'impact'],
    ['/assets/vfx/retro/critical_hit_02.png', 'critical'],
    ['/assets/vfx/foozle/tornado_02.png', 'whirlwind'],
    ['/assets/vfx/spells/explosion_7.png', 'explosion'],
    ['/assets/vfx/spells/fire_flame.png', 'flame'],
    ['/assets/vfx/kenney/sparkle_star.png', 'sparkle'],
    ['/assets/vfx/spells/heal_green.png', 'heal'],
    ['/assets/vfx/spells/portal_ring.png', 'portal'],
    ['/assets/vfx/spells/magic_aura_glow.png', 'aura'],
    ['/assets/vfx/retro/smoke_dust.png', 'smoke'],
  ]
  for (const [path, kind] of cases) assert.equal(classifyVfxAsset(path, 96, 96)?.kind, kind, path)
})

test('semantic folders classify generic filenames from mixed vfx packs', () => {
  assert.equal(classifyVfxAsset('/assets/vfx/foozle/Lightning/001.png', 64, 64, { source: 'foozle' })?.kind, 'lightning')
  assert.equal(classifyVfxAsset('/assets/vfx/free-pixel-magic/Fire/0007.png', 64, 64, { source: 'free-pixel-magic' })?.kind, 'flame')
  assert.equal(classifyVfxAsset('/assets/vfx/free-pixel-magic/Magic Circle/03.png', 64, 64, { source: 'free-pixel-magic' })?.kind, 'aura')
})

test('lightning source context safely classifies generic lightning pack filenames', () => {
  assert.equal(classifyVfxAsset('/assets/vfx/cache/001.png', 64, 64, { source: 'lightning' })?.kind, 'lightning')
  assert.equal(classifyVfxAsset('/assets/vfx/cache/001.png', 64, 64, { source: 'unknown-pack' }), null)
})

test('specific semantic rules beat broad aliases', () => {
  assert.equal(classifyVfxAsset('/assets/vfx/retro/critical_hit_burst.png', 96, 96)?.kind, 'critical')
  assert.equal(classifyVfxAsset('/assets/vfx/spells/heal_sparkle.png', 96, 96)?.kind, 'heal')
  assert.equal(classifyVfxAsset('/assets/vfx/spells/portal_glow.png', 96, 96)?.kind, 'portal')
  assert.equal(classifyVfxAsset('/assets/vfx/retro/smoke_burst.png', 96, 96)?.kind, 'smoke')
})

test('keeps useful dimensions and rejects unrelated pngs', () => {
  assert.deepEqual(classifyVfxAsset('/assets/vfx/free/beam_strip.png', 512, 64), {
    kind: 'beam', width: 512, height: 64, path: '/assets/vfx/free/beam_strip.png',
  })
  assert.equal(classifyVfxAsset('/assets/vfx/readme_preview.png', 800, 600), null)
  assert.equal(classifyVfxAsset('/assets/vfx/background_cloud.png', 800, 600), null)
})

test('rejects vfx whose source image has no alpha channel', () => {
  assert.equal(classifyVfxAsset('/assets/vfx/free/laser_black_background.png', 256, 32, { hasAlpha: false }), null)
  assert.equal(classifyVfxAsset('/assets/vfx/free/laser_transparent.png', 256, 32, { hasAlpha: true }).kind, 'beam')
})

test('retro impact source is limited to impact-oriented categories', () => {
  assert.equal(classifyVfxAsset('/assets/vfx/retro-impact/critical_hit.png', 96, 96)?.kind, 'critical')
  assert.equal(classifyVfxAsset('/assets/vfx/retro-impact/smoke.png', 96, 96)?.kind, 'smoke')
  assert.equal(classifyVfxAsset('/assets/vfx/retro-impact/fire_flame.png', 96, 96), null)
  assert.equal(classifyVfxAsset('/assets/vfx/retro-impact/lightning_bolt.png', 96, 96), null)
  assert.equal(classifyVfxAsset('/assets/vfx/cache/lightning_bolt.png', 96, 96, { source: 'retro-impact' }), null)
})
