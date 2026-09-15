import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerEntity } from './player-entity.js'
import { installDungeonWeaponProjectiles } from './weapon-projectile-runtime.js'

function bowPlayer(id, x = 10, y = 20) {
  return new PlayerEntity({
    id,
    state: {
      x,
      y,
      damage: 20,
      critChance: 0,
      critMultiplier: 2,
      modifiers: {},
      equipment: { weapon: { type: `weapon.${id}_bow`, archetype: 'bow', rarity: 'rare' } },
    },
    facing: 'right',
  })
}

function sceneFixture() {
  return {
    enemies: [],
    slash() {},
    textures: { exists() { return true } },
    load: { image() {} },
    events: { on() {}, off() {}, once() {} },
  }
}

test('weapon projectile runtime can bind to an explicit PlayerEntity without scene.localPlayer', () => {
  const player = bowPlayer('remote')
  const scene = sceneFixture()

  const runtime = installDungeonWeaponProjectiles(scene, { player })

  assert.ok(runtime)
  runtime.restore()
})

test('scene projectile dispatch routes attacks to each player runtime', () => {
  const first = bowPlayer('first', 10, 20)
  const second = bowPlayer('second', 30, 40)
  const scene = sceneFixture()
  scene.localPlayer = first
  const target = { id: 'target', x: 120, y: 20, hp: 100, maxHp: 100 }

  const firstRuntime = installDungeonWeaponProjectiles(scene, { player: first })
  const secondRuntime = installDungeonWeaponProjectiles(scene, { player: second })

  assert.notEqual(firstRuntime, secondRuntime)
  assert.equal(first.runtime.weaponProjectiles, firstRuntime)
  assert.equal(second.runtime.weaponProjectiles, secondRuntime)
  assert.equal(scene.__dungeonWeaponProjectiles, firstRuntime)

  const firstShot = scene.slash(target, first)
  const secondShot = scene.slash(target, second)
  assert.equal(firstShot.attacker, first)
  assert.equal(secondShot.attacker, second)

  secondRuntime.restore()
  firstRuntime.restore()
})
