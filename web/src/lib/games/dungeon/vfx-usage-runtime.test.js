import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonWorldVfx, worldVfxProfile } from './vfx-usage-runtime.js'

test('worldVfxProfile makes higher-rarity loot more prominent', () => {
  assert.ok(worldVfxProfile({ type: 'weapon.dungeon_blade', rarity: 'epic' }, 'drop').scale > worldVfxProfile({ type: 'weapon.dungeon_blade', rarity: 'common' }, 'drop').scale)
  assert.equal(worldVfxProfile({ type: 'consumable.health_potion' }, 'pickup').tint, 0xff7c86)
})

test('world vfx reacts to explicit loot, pickup, portal and rest-room state', () => {
  const sparkles = []
  const flames = []
  let update = null
  let role = 'combat'
  const scene = {
    portal: null,
    __roomGeometry: { rest: { x: 300, y: 220 } },
    __dungeonVfx: {
      sparkle(x, y, options) { sparkles.push({ x, y, options }) },
      flame(x, y, options) { flames.push({ x, y, options }) },
    },
    spawnDrop() {},
    pickupBurst() {},
    __infiniteDungeon: { getProgress: () => ({ roomRole: role }) },
    time: { addEvent: () => ({ remove() {} }) },
    events: {
      on(event, handler) { if (event === 'update') update = handler },
      off() {},
      once() {},
    },
  }

  installDungeonWorldVfx(scene)
  scene.spawnDrop(120, 140, { type: 'weapon.dungeon_blade', rarity: 'rare' })
  scene.pickupBurst(120, 140, { type: 'consumable.health_potion' }, 20)
  scene.portal = { x: 480, y: 500 }
  update()

  assert.equal(sparkles.length, 5)
  assert.equal(sparkles[1].options.tint, 0xff7c86)
  assert.equal(sparkles[2].options.tint, 0x70ff9f)

  role = 'rest'
  update()
  assert.equal(flames.length, 1)
  assert.deepEqual([flames[0].x, flames[0].y], [300, 225])
})
