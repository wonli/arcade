import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonWorldVfx, worldVfxProfile } from './vfx-usage-runtime.js'

test('worldVfxProfile makes higher-rarity loot more prominent', () => {
  assert.ok(worldVfxProfile({ type: 'weapon.dungeon_blade', rarity: 'epic' }, 'drop').scale > worldVfxProfile({ type: 'weapon.dungeon_blade', rarity: 'common' }, 'drop').scale)
  assert.equal(worldVfxProfile({ type: 'consumable.health_potion' }, 'pickup').tint, 0xff7c86)
})

test('world vfx translates loot, heal, portal, rest, equip, floor clear and elite state', () => {
  const calls = []
  let update = null
  let role = 'combat'
  const scene = {
    portal: null,
    floorCleared: false,
    enemies: [],
    playerState: {
      x: 100,
      y: 110,
      equipment: { weapon: { type: 'weapon.sword', rarity: 'common', damage: 5, affixes: [] } },
    },
    __roomGeometry: { rest: { x: 300, y: 220 } },
    __dungeonVfx: Object.fromEntries(['sparkle', 'flame', 'heal', 'portal', 'aura'].map((kind) => [kind, (...args) => calls.push([kind, ...args])])),
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

  installDungeonWorldVfx(attachLegacyTestPlayer(scene))
  scene.spawnDrop(120, 140, { type: 'weapon.dungeon_blade', rarity: 'rare' })
  scene.pickupBurst(120, 140, { type: 'consumable.health_potion' }, 20)
  scene.portal = { x: 480, y: 500 }
  scene.enemies = [{ x: 600, y: 300, hp: 40, elite: true }]
  scene.floorCleared = true
  scene.localPlayer.state.equipment.weapon = { ...scene.localPlayer.state.equipment.weapon, damage: 9 }
  update()

  assert.ok(calls.some(([kind]) => kind === 'sparkle'))
  assert.ok(calls.some(([kind]) => kind === 'heal'))
  assert.ok(calls.some(([kind]) => kind === 'portal'))
  assert.ok(calls.filter(([kind]) => kind === 'aura').length >= 3)

  role = 'rest'
  update()
  assert.ok(calls.some(([kind, x, y]) => kind === 'flame' && x === 300 && y === 225))
})

test('no-op pickup does not emit heal vfx', () => {
  const heals = []
  const scene = {
    playerState: {}, enemies: [],
    spawnDrop() {}, pickupBurst() {},
    __dungeonVfx: { sparkle() {}, heal(...args) { heals.push(args) } },
    events: { on() {}, off() {}, once() {} },
  }
  installDungeonWorldVfx(attachLegacyTestPlayer(scene))
  scene.pickupBurst(1, 2, { type: 'consumable.health_potion' }, 0)
  assert.equal(heals.length, 0)
})
