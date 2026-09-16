import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonWeaponVisuals } from './weapon-visual-runtime.js'

function displayObject(kind, x = 0, y = 0) {
  return {
    kind,
    x,
    y,
    visible: true,
    setOrigin() { return this },
    setScale() { return this },
    setVisible(value) { this.visible = value; return this },
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this },
    setAngle() { return this },
    setFlipX() { return this },
    setDepth() { return this },
    setStrokeStyle() { return this },
    destroy() { this.destroyed = true },
  }
}

test('equipped named weapon upgrades its procedural fallback after textures finish loading', () => {
  let loadComplete = null
  let update = null
  const loaded = new Set()
  const scene = attachLegacyTestPlayer({
    playerState: {
      x: 100,
      y: 120,
      equipment: {
        weapon: { type: 'weapon.grave_cleaver', archetype: 'axe', rarity: 'rare' },
      },
      modifiers: {},
    },
    playerFacing: 'right',
    time: { now: 100, delayedCall() {} },
    textures: { exists: (key) => loaded.has(key) },
    add: {
      rectangle(x, y) {
        return displayObject('rectangle', x, y)
      },
      container(x, y, parts) {
        return {
          ...displayObject('procedural', x, y),
          parts,
          setSize() { return this },
        }
      },
      image(x, y, textureKey) {
        return {
          ...displayObject('image', x, y),
          textureKey,
        }
      },
    },
    load: {
      image() {},
      once(event, callback) {
        if (event === 'complete') loadComplete = callback
      },
      start() {},
    },
    events: {
      on(event, callback) {
        if (event === 'update') update = callback
      },
      off() {},
      once() {},
    },
  })

  const runtime = installDungeonWeaponVisuals(scene)
  assert.equal(typeof update, 'function')
  update()

  const fallback = runtime.visual()
  assert.equal(fallback?.kind, 'procedural')

  loaded.add('dungeon-named-weapon-034-base')
  assert.equal(typeof loadComplete, 'function')
  loadComplete()

  assert.equal(fallback.destroyed, true)
  assert.equal(runtime.visual()?.kind, 'image')
  assert.equal(runtime.visual()?.textureKey, 'dungeon-named-weapon-034-base')
})

// CI verification trigger; removed by the following commit.
