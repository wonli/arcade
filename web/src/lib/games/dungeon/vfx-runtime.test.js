import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonVfx, selectVfx, selectVfxVariant, vfxBlendMode, vfxCatalog } from './vfx-runtime.js'

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

test('blend mode accounts for source packs that rely on additive black removal', () => {
  assert.equal(vfxBlendMode('slash', { source: 'spell-effects' }), 'ADD')
  assert.equal(vfxBlendMode('whirlwind', { source: 'foozle' }), 'ADD')
  assert.equal(vfxBlendMode('impact', { source: 'retro-impact' }), 'NORMAL')
  assert.equal(vfxBlendMode('critical', { source: 'retro-impact' }), 'NORMAL')
  assert.equal(vfxBlendMode('beam', { source: 'free-pixel-magic' }), 'ADD')
})

function gameObject(key) {
  return {
    key,
    setDepth(){ return this },
    setAlpha(){ return this },
    setAngle(){ return this },
    setBlendMode(){ return this },
    setTint(){ return this },
    setScale(){ return this },
    play(){ return this },
    once(){ return this },
    destroy(){},
  }
}

test('combat VFX never draw Phaser geometry and only instantiate loaded VFX textures', () => {
  const used = []
  const forbidden = () => { throw new Error('procedural combat VFX are forbidden') }
  const combatManifest = {
    assets: [
      { kind: 'beam', source: 'free-pixel-magic', path: '/beam.png', width: 64, height: 16, frames: 1 },
      { kind: 'lightning', source: 'lightning', path: '/lightning.png', width: 64, height: 16, frames: 1 },
      { kind: 'whirlwind', source: 'foozle', path: '/whirlwind.png', width: 64, height: 64, frames: 1 },
      { kind: 'slash', source: 'spell-effects', path: '/slash.png', width: 64, height: 64, frames: 1 },
      { kind: 'impact', source: 'retro-impact', path: '/impact.png', width: 64, height: 64, frames: 1 },
      { kind: 'critical', source: 'retro-impact', path: '/critical.png', width: 64, height: 64, frames: 1 },
      { kind: 'sparkle', source: 'kenney-particles', path: '/sparkle.png', width: 32, height: 32, frames: 1 },
    ],
  }
  const scene = {
    textures: { exists: () => true },
    load: { once(){}, start(){}, image(){}, spritesheet(){} },
    anims: { exists: () => false, create(){}, generateFrameNumbers(){ return [] } },
    tweens: { add(){} },
    add: {
      image(x, y, key) { used.push(key); return gameObject(key) },
      sprite(x, y, key) { used.push(key); return gameObject(key) },
      rectangle: forbidden,
      circle: forbidden,
      arc: forbidden,
      graphics: forbidden,
    },
  }

  const vfx = installDungeonVfx(attachLegacyTestPlayer(scene), combatManifest)
  vfx.beam({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, width: 28 })
  vfx.lightning({ x: 0, y: 0 }, { x: 80, y: 20 }, { primary: true })
  vfx.whirlwind({ center: { x: 20, y: 30 }, radius: 90 })
  vfx.slash({ x: 0, y: 0 }, { x: 50, y: 20 }, true)
  vfx.impact(40, 50)
  vfx.critical(40, 50)

  assert.ok(used.length >= 6)
  assert.ok(used.every((key) => key.startsWith('dungeon-vfx-')))
})
