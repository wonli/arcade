import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonWeaponVisuals, weaponVisualProfile, weaponPose } from './weapon-visual-runtime.js'

test('weapon visual profile maps rarity to distinct Soul weapon art without changing gameplay data', () => {
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'common' }).path, /sword_01\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'uncommon' }).path, /sword_08\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'rare' }).path, /sword_15\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'epic' }).path, /gold_sword\.png$/)
  assert.equal(weaponVisualProfile(null), null)
})

test('idle weapon trails behind player facing and stays behind the character layer', () => {
  const player = { x: 100, y: 120 }
  const right = weaponPose(player, 'right')
  const left = weaponPose(player, 'left')
  const up = weaponPose(player, 'up')
  const down = weaponPose(player, 'down')

  assert.ok(right.x < player.x)
  assert.ok(left.x > player.x)
  assert.ok(up.y > player.y)
  assert.ok(down.y < player.y)
  for (const pose of [right, left, up, down]) assert.ok(pose.depth < 20)
})

test('attacking pose moves weapon to the facing side and in front of the character', () => {
  const player = { x: 200, y: 200 }
  const right = weaponPose(player, 'right', { attacking: true })
  const left = weaponPose(player, 'left', { attacking: true })
  const up = weaponPose(player, 'up', { attacking: true })
  const down = weaponPose(player, 'down', { attacking: true })

  assert.ok(right.x > player.x && right.tip.x > player.x)
  assert.ok(left.x < player.x && left.tip.x < player.x)
  assert.ok(up.y < player.y && up.tip.y < player.y)
  assert.ok(down.y > player.y && down.tip.y > player.y)
  for (const pose of [right, left, up, down]) assert.ok(pose.depth > 20)
})

test('weapon flip follows the corrected side-sprite facing semantics', () => {
  const player = { x: 0, y: 0 }
  assert.equal(weaponPose(player, 'left').flipX, false)
  assert.equal(weaponPose(player, 'right').flipX, true)
})

test('runtime attaches one weapon sprite, follows the player and returns the blade tip on swing', () => {
  let update = null
  const created = []
  const scene = {
    playerState: { x: 100, y: 120, weapon: 'weapon.dungeon_blade', weaponRarity: 'rare' },
    playerFacing: 'right',
    time: { now: 100, delayedCall() {} },
    textures: { exists: () => true },
    add: {
      image(x, y, key) {
        const object = {
          x, y, key, visible: true, angle: 0, depth: 0, flipX: false,
          setOrigin() { return this }, setScale() { return this }, setVisible(value) { this.visible = value; return this },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this }, setAngle(value) { this.angle = value; return this },
          setFlipX(value) { this.flipX = value; return this }, setDepth(value) { this.depth = value; return this }, destroy() { this.destroyed = true },
        }
        created.push(object)
        return object
      },
    },
    load: { image() {}, once() {}, start() {} },
    events: {
      on(event, handler) { if (event === 'update') update = handler },
      off() {}, once() {},
    },
  }

  const runtime = installDungeonWeaponVisuals(scene)
  update()
  assert.equal(created.length, 1)
  assert.equal(created[0].key, 'dungeon-held-weapon-rare')
  assert.ok(created[0].x < scene.playerState.x)
  assert.ok(created[0].depth < 20)
  assert.equal(created[0].flipX, true)

  const tip = runtime.swing()
  assert.ok(created[0].x > scene.playerState.x)
  assert.ok(created[0].depth > 20)
  assert.ok(tip.x > scene.playerState.x)

  scene.playerState.x = 160
  scene.time.now = 300
  update()
  assert.ok(created[0].x < 160)
  assert.ok(created[0].depth < 20)
})
