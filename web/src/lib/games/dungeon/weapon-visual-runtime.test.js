import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerEntity } from './player-entity.js'
import { createWeaponVisual, installDungeonWeaponVisuals, weaponVisualProfile, weaponPose } from './weapon-visual-runtime.js'

test('weapon visual profile maps archetype and rarity to existing Soul art', () => {
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'common' }).path, /dagger_01\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'epic' }).path, /gold_dagger\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'sword', rarity: 'rare' }).path, /sword_15\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'katana', rarity: 'rare' }).path, /katana\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'common' }).path, /sword_01\.png$/)
  assert.equal(weaponVisualProfile(null), null)
})

test('procedural axe visual is available without a PNG texture', () => {
  const children = []
  const makePart = (kind) => ({ kind, setAngle() { return this }, setStrokeStyle() { return this } })
  const scene = {
    add: {
      rectangle() { const part = makePart('rectangle'); children.push(part); return part },
      container(x, y, parts) { return { x, y, parts, scaleX: 1, scaleY: 1, setSize() { return this }, setScale(value) { this.scaleX = value; this.scaleY = value; return this } } },
    },
    textures: { exists: () => false },
  }
  const visual = createWeaponVisual(scene, { type: 'weapon.grave_cleaver', archetype: 'axe', rarity: 'rare' }, 40, 50)
  assert.ok(visual)
  assert.equal(visual.x, 40)
  assert.equal(visual.y, 50)
  assert.equal(visual.parts.length, 3)
  assert.ok(visual.scaleX > 1)
})

test('idle weapon uses facing-aware character layering', () => {
  const player = { x: 100, y: 120 }
  const [right, left, up, down] = ['right', 'left', 'up', 'down'].map((facing) => weaponPose(player, facing))
  assert.ok(right.x < player.x)
  assert.ok(left.x > player.x)
  assert.ok(up.y > player.y)
  assert.ok(down.y < player.y)
  assert.ok(right.depth < 20)
  assert.ok(left.depth < 20)
  assert.ok(down.depth < 20)
  assert.ok(up.depth > 20)
})

test('idle weapon is rotated ninety degrees into a vertical back carry', () => {
  const player = { x: 100, y: 120 }
  assert.equal(weaponPose(player, 'right').angle, 52)
  assert.equal(weaponPose(player, 'left').angle, 128)
  assert.equal(weaponPose(player, 'up').angle, 128)
  assert.equal(weaponPose(player, 'down').angle, 52)
})

test('long weapons ride higher on the back instead of dragging into the ground', () => {
  const player = { x: 100, y: 120 }
  const sword = weaponPose(player, 'right', { reachScale: 1 })
  const staff = weaponPose(player, 'right', { reachScale: 1.25 })
  const spear = weaponPose(player, 'right', { reachScale: 1.5 })
  assert.ok(staff.y < sword.y)
  assert.ok(spear.y < staff.y)
  assert.ok(sword.y - spear.y >= 12)
  assert.equal(spear.angle, sword.angle)
  assert.equal(spear.depth, sword.depth)
})

test('attack reach scales with weapon archetype', () => {
  const player = { x: 200, y: 200 }
  const dagger = weaponPose(player, 'right', { attacking: true, reachScale: 0.78 })
  const sword = weaponPose(player, 'right', { attacking: true, reachScale: 1 })
  const katana = weaponPose(player, 'right', { attacking: true, reachScale: 1.22 })
  assert.ok(dagger.tip.x < sword.tip.x); assert.ok(katana.tip.x > sword.tip.x)
  assert.ok(sword.x > player.x && sword.depth > 20)
})

test('weapon flip follows corrected side-sprite facing semantics', () => {
  assert.equal(weaponPose({ x: 0, y: 0 }, 'left').flipX, false); assert.equal(weaponPose({ x: 0, y: 0 }, 'right').flipX, true)
})

function visualScene() {
  let update = null, delayed = null
  const created = []
  const scene = {
    playerState: {
      x: 100,
      y: 120,
      equipment: { weapon: { type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'rare' } },
      modifiers: {},
    },
    playerFacing: 'right', time: { now: 100, delayedCall(ms) { delayed = ms } }, textures: { exists: () => true },
    add: { image(x, y, key) { const object = { x, y, key, visible: true, angle: 0, depth: 0, flipX: false, setOrigin() { return this }, setScale() { return this }, setVisible(value) { this.visible = value; return this }, setPosition(nx, ny) { this.x = nx; this.y = ny; return this }, setAngle(value) { this.angle = value; return this }, setFlipX(value) { this.flipX = value; return this }, setDepth(value) { this.depth = value; return this }, destroy() {} }; created.push(object); return object } },
    load: { image() {}, once() {}, start() {} }, events: { on(event, handler) { if (event === 'update') update = handler }, off() {}, once() {} },
  }
  return { scene, created, getUpdate: () => update, getDelayed: () => delayed }
}

test('runtime uses archetype swing duration, follows the player, and is owned by that player', () => {
  const fixture = visualScene()
  const scene = attachLegacyTestPlayer(fixture.scene)
  const runtime = installDungeonWeaponVisuals(scene)
  fixture.getUpdate()(); assert.match(fixture.created[0].key, /dagger-rare$/); assert.ok(fixture.created[0].x < scene.localPlayer.state.x)
  assert.equal(scene.localPlayer.runtime.weaponVisuals, runtime)
  const tip = runtime.swing(); assert.equal(fixture.getDelayed(), 110); assert.ok(tip.x > scene.localPlayer.state.x)
})

test('weapon visual runtimes are isolated per PlayerEntity', () => {
  const fixture = visualScene()
  const scene = attachLegacyTestPlayer(fixture.scene)
  const remote = new PlayerEntity({
    id: 'remote',
    state: {
      x: 300,
      y: 220,
      equipment: { weapon: { type: 'weapon.remote_blade', archetype: 'sword', rarity: 'rare' } },
      modifiers: {},
    },
    facing: 'left',
  })

  const localRuntime = installDungeonWeaponVisuals(scene, { player: scene.localPlayer })
  const remoteRuntime = installDungeonWeaponVisuals(scene, { player: remote })

  assert.notEqual(localRuntime, remoteRuntime)
  assert.equal(scene.localPlayer.runtime.weaponVisuals, localRuntime)
  assert.equal(remote.runtime.weaponVisuals, remoteRuntime)
  assert.equal(scene.__dungeonWeaponVisuals, localRuntime)

  remoteRuntime.restore()
  assert.equal(scene.localPlayer.runtime.weaponVisuals, localRuntime)
  assert.equal(scene.__dungeonWeaponVisuals, localRuntime)
})
