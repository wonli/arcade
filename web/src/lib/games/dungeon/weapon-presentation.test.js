import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeWeaponPresentationConfig,
  resolveWeaponPresentation,
  transformWeaponAnchor,
} from './weapon-presentation.js'

const config = {
  version: 1,
  defaults: {
    scale: 1,
    grip: { x: 0.5, y: 0.78 },
    vfxAnchor: { x: 0.5, y: 0.08 },
    vfxSizeScale: 1,
    poses: {
      idle: {
        right: { x: -15, y: 6, angle: 52 },
        left: { x: 15, y: 6, angle: 128 },
        up: { x: 8, y: 15, angle: 128 },
        down: { x: 8, y: -15, angle: 52 },
      },
      attack: {
        right: { x: 17, y: 5, angle: 84 },
        left: { x: -17, y: 5, angle: -84 },
        up: { x: 10, y: -16, angle: -84 },
        down: { x: 10, y: 17, angle: 84 },
      },
    },
  },
  weapons: {
    'weapon.kings_ruin': {
      scale: 1.1,
      vfxSizeScale: 1.2,
      poses: { idle: { right: { x: -18, angle: 47 } } },
    },
  },
}

test('default presentation preserves current weapon pose values', () => {
  const normalized = normalizeWeaponPresentationConfig(config)
  const idle = resolveWeaponPresentation(normalized, { type: 'weapon.warden_blade' }, 'right', { attacking: false })
  const attack = resolveWeaponPresentation(normalized, { type: 'weapon.warden_blade' }, 'right', { attacking: true })
  assert.deepEqual(idle.pose, { x: -15, y: 6, angle: 52 })
  assert.deepEqual(attack.pose, { x: 17, y: 5, angle: 84 })
  assert.equal(idle.scale, 1)
  assert.equal(idle.vfxSizeScale, 1)
})

test('per-weapon presentation overrides only the specified values', () => {
  const resolved = resolveWeaponPresentation(config, { type: 'weapon.kings_ruin' }, 'right', { attacking: false })
  assert.deepEqual(resolved.pose, { x: -18, y: 6, angle: 47 })
  assert.equal(resolved.scale, 1.1)
  assert.equal(resolved.vfxSizeScale, 1.2)
  assert.deepEqual(resolved.grip, { x: 0.5, y: 0.78 })
  assert.deepEqual(resolved.vfxAnchor, { x: 0.5, y: 0.08 })
})

test('weapon-local anchors follow scale rotation and horizontal flip', () => {
  const visual = {
    x: 100,
    y: 100,
    width: 32,
    height: 32,
    originX: 0.5,
    originY: 0.5,
    scaleX: 2,
    scaleY: 2,
    angle: 90,
    flipX: false,
  }
  const point = transformWeaponAnchor(visual, { x: 1, y: 0.5 })
  assert.ok(Math.abs(point.x - 100) < 1e-6)
  assert.ok(Math.abs(point.y - 132) < 1e-6)

  const flipped = transformWeaponAnchor({ ...visual, angle: 0, flipX: true }, { x: 1, y: 0.5 })
  assert.ok(Math.abs(flipped.x - 68) < 1e-6)
  assert.ok(Math.abs(flipped.y - 100) < 1e-6)
})
