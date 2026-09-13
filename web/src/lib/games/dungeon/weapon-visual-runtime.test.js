import test from 'node:test'
import assert from 'node:assert/strict'

import { weaponVisualProfile, weaponPose } from './weapon-visual-runtime.js'

test('weapon visual profile maps rarity to distinct Soul weapon art without changing gameplay data', () => {
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'common' }).path, /sword_01\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'uncommon' }).path, /sword_08\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'rare' }).path, /sword_15\.png$/)
  assert.match(weaponVisualProfile({ type: 'weapon.dungeon_blade', rarity: 'epic' }).path, /gold_sword\.png$/)
  assert.equal(weaponVisualProfile(null), null)
})

test('weapon pose follows four player facings and exposes the blade tip for VFX alignment', () => {
  const player = { x: 100, y: 120 }
  const right = weaponPose(player, 'right')
  const left = weaponPose(player, 'left')
  const up = weaponPose(player, 'up')
  const down = weaponPose(player, 'down')

  assert.ok(right.x > player.x && right.tip.x > right.x)
  assert.ok(left.x < player.x && left.tip.x < left.x)
  assert.ok(up.y < player.y && up.tip.y < up.y)
  assert.ok(down.y > player.y && down.tip.y > down.y)
})

test('attacking pose swings around the hand while preserving the facing side', () => {
  const player = { x: 200, y: 200 }
  const idle = weaponPose(player, 'right')
  const attack = weaponPose(player, 'right', { attacking: true })
  assert.notEqual(attack.angle, idle.angle)
  assert.ok(attack.x > player.x)
  assert.ok(attack.tip.x > player.x)
})
