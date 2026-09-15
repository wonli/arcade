import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerEntity } from './player-entity.js'
import { installDungeonWeaponProjectiles } from './weapon-projectile-runtime.js'

test('weapon projectile runtime can bind to an explicit PlayerEntity without scene.localPlayer', () => {
  const player = new PlayerEntity({
    id: 'remote',
    state: {
      x: 10,
      y: 20,
      damage: 20,
      critChance: 0,
      critMultiplier: 2,
      effects: {},
      equippedWeapon: { type: 'weapon.remote_bow', archetype: 'bow', rarity: 'rare' },
    },
    facing: 'right',
  })
  const scene = {
    slash() {},
    textures: { exists() { return true } },
    load: { image() {} },
    events: { on() {}, off() {}, once() {} },
  }

  const runtime = installDungeonWeaponProjectiles(scene, { player })

  assert.ok(runtime)
  runtime.restore()
})
