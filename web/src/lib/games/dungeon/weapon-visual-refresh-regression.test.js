import test from 'node:test'
import assert from 'node:assert/strict'

import { installPickupInteraction } from './pickup-runtime.js'
import { attachLegacyTestPlayer } from './test/player-fixture.js'

function drawable(extra = {}) {
  return {
    scaleX: 1,
    scaleY: 1,
    destroyed: false,
    setAngle() { return this },
    setDepth() { return this },
    setOrigin() { return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this },
    setSize() { return this },
    setY(y) { this.y = y; return this },
    destroy() { this.destroyed = true },
    ...extra,
  }
}

test('hydrated named ground weapon upgrades its procedural fallback after textures finish loading', () => {
  let textureReady = false
  let loadComplete = null
  const scene = attachLegacyTestPlayer({
    floor: 2,
    playerState: {
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      healthPotions: 0,
      equipment: { weapon: null },
      modifiers: {},
    },
    drops: [],
    time: { now: 1000 },
    input: { keyboard: { addKey: () => ({ on() {}, off() {} }) } },
    events: { once() {}, on() {}, off() {} },
    load: {
      on(event, listener) { if (event === 'complete') loadComplete = listener },
      off(event, listener) { if (event === 'complete' && loadComplete === listener) loadComplete = null },
    },
    textures: {
      exists(key) {
        return textureReady && key === 'dungeon-named-weapon-087-base'
      },
    },
    add: {
      rectangle() { return drawable() },
      container(x, y, children) { return drawable({ kind: 'procedural', x, y, children }) },
      image(x, y, textureKey) { return drawable({ kind: 'texture', x, y, textureKey }) },
    },
    tweens: { killTweensOf() {} },
    emitStats() {},
    updateHealthBar() {},
    pickupBurst() {},
    spawnDrop(x, y, item) {
      this.drops.push({ x, y, item, visual: null, glow: { setAlpha() {} }, sparkles: [] })
    },
    destroyDrop(drop) { drop?.visual?.destroy?.() },
    clearDrops() { this.drops = [] },
    updateDrops() {},
  })

  const runtime = installPickupInteraction(scene)
  scene.spawnDrop(120, 80, {
    type: 'weapon.storm_lance',
    archetype: 'spear',
    rarity: 'rare',
    damage: 28,
    affixes: [],
  })

  assert.equal(scene.drops[0].visual?.kind, 'procedural')
  assert.equal(typeof loadComplete, 'function')

  textureReady = true
  loadComplete()

  assert.equal(scene.drops[0].visual?.kind, 'texture')
  assert.equal(scene.drops[0].visual?.textureKey, 'dungeon-named-weapon-087-base')
  runtime.restore()
})

test('ground weapon presentation can upgrade a replay placeholder without installing pickup gameplay', async () => {
  const pickupModule = await import('./pickup-runtime.js')
  assert.equal(typeof pickupModule.syncGroundWeaponPresentation, 'function')

  const placeholder = drawable({ kind: 'placeholder' })
  const scene = {
    textures: { exists: (key) => key === 'dungeon-named-weapon-087-base' },
    add: {
      image(x, y, textureKey) { return drawable({ kind: 'texture', x, y, textureKey }) },
      rectangle() { return drawable() },
      container(x, y, children) { return drawable({ kind: 'procedural', x, y, children }) },
    },
    tweens: { killTweensOf() {} },
  }
  const drop = {
    x: 120,
    y: 80,
    item: {
      type: 'weapon.storm_lance',
      archetype: 'spear',
      rarity: 'rare',
      damage: 28,
      affixes: [],
    },
    visual: placeholder,
    label: null,
  }

  const visual = pickupModule.syncGroundWeaponPresentation(scene, drop, { x: 120, y: 80 })
  assert.equal(placeholder.destroyed, true)
  assert.equal(visual?.kind, 'texture')
  assert.equal(drop.visual?.textureKey, 'dungeon-named-weapon-087-base')
})

test('weapon art can be queued for replay without installing combat runtime', async () => {
  const weaponModule = await import('./weapon-visual-runtime.js')
  assert.equal(typeof weaponModule.queueDungeonWeaponArt, 'function')

  const queued = []
  const scene = {
    textures: { exists: () => false },
    load: { image(key, path) { queued.push([key, path]) } },
  }

  const count = weaponModule.queueDungeonWeaponArt(scene, { includeSelected: false })
  assert.equal(count, queued.length)
  assert.ok(queued.some(([key]) => key === 'dungeon-held-weapon-sword-common'))
  assert.ok(queued.some(([key]) => key === 'dungeon-named-weapon-087-base'))
  assert.equal(queued.some(([key]) => key.endsWith('-selected')), false)
})
