import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponVisuals, weaponVisualProfile, weaponPose } from './weapon-visual-runtime.js'

test('weapon visual profile maps archetype and rarity to existing Soul art', () => {
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'common' }).path, /dagger_01\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'epic' }).path, /gold_dagger\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'sword', rarity: 'rare' }).path, /sword_15\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', archetype: 'katana', rarity: 'rare' }).path, /katana\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'common' }).path, /sword_01\.png$/)
  assert.equal(weaponVisualProfile(null), null)
})

test('idle weapon trails behind player facing and stays behind character layer', () => {
  const player = { x: 100, y: 120 }
  const poses = ['right', 'left', 'up', 'down'].map((facing) => weaponPose(player, facing))
  assert.ok(poses[0].x < player.x); assert.ok(poses[1].x > player.x); assert.ok(poses[2].y > player.y); assert.ok(poses[3].y < player.y)
  for (const pose of poses) assert.ok(pose.depth < 20)
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

test('runtime uses archetype swing duration and follows the player', () => {
  let update = null, delayed = null
  const created = []
  const scene = {
    playerState: { x: 100, y: 120, weapon: 'weapon.dungeon_blade', weaponRarity: 'rare', equippedWeapon: { type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'rare' } },
    playerFacing: 'right', time: { now: 100, delayedCall(ms) { delayed = ms } }, textures: { exists: () => true },
    add: { image(x, y, key) { const object = { x, y, key, visible: true, angle: 0, depth: 0, flipX: false, setOrigin() { return this }, setScale() { return this }, setVisible(value) { this.visible = value; return this }, setPosition(nx, ny) { this.x = nx; this.y = ny; return this }, setAngle(value) { this.angle = value; return this }, setFlipX(value) { this.flipX = value; return this }, setDepth(value) { this.depth = value; return this }, destroy() {} }; created.push(object); return object } },
    load: { image() {}, once() {}, start() {} }, events: { on(event, handler) { if (event === 'update') update = handler }, off() {}, once() {} },
  }
  const runtime = installDungeonWeaponVisuals(scene); update(); assert.match(created[0].key, /dagger-rare$/); assert.ok(created[0].x < scene.playerState.x)
  const tip = runtime.swing(); assert.equal(delayed, 110); assert.ok(tip.x > scene.playerState.x)
})
