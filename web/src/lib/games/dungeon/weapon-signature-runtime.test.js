import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerEntity } from './player-entity.js'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'

function staffState(type, signature, x = 0, y = 0) {
  return {
    x,
    y,
    modifiers: {},
    equipment: { weapon: { type, archetype: 'staff', signature } },
  }
}

function signatureScene(signature = 'storm_palm', player = null) {
  const hits = []
  const lightning = []
  const scene = {
    playerState: staffState(`weapon.${signature}`, signature),
    enemies: [],
    damageEnemy(target, damage, critical, knockback, context, attacker) {
      hits.push({ target, damage, context, attacker })
      target.hp -= damage
    },
    __dungeonVfx: {
      lightning(from, to, options) { lightning.push({ from, to, options }) },
    },
    __dungeonWeaponVfx: { nova() {} },
  }
  attachLegacyTestPlayer(scene)
  const runtime = installDungeonWeaponSignatures(scene, { player: player ?? scene.localPlayer })
  return { scene, runtime, hits, lightning }
}

test('Storm Palm deterministically deals 60/35/20 percent damage to at most three targets', () => {
  const { scene, runtime, hits } = signatureScene('storm_palm')
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000 }
  const first = { id: 'first', x: 72, y: 0, hp: 1000 }
  const second = { id: 'second', x: 104, y: 0, hp: 1000 }
  const third = { id: 'third', x: 136, y: 0, hp: 1000 }
  scene.enemies = [primary, first, second, third]

  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)

  assert.deepEqual(hits.map((hit) => [hit.target.id, hit.damage]), [
    ['primary', 12], ['first', 7], ['second', 4],
  ])
  assert.ok(hits.every((hit) => hit.context.direct === false && hit.context.canProc === false))
})

test('Storm Palm renders one resource lightning segment for the primary and each chain hop', () => {
  const { scene, runtime, lightning } = signatureScene('storm_palm')
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000 }
  const first = { id: 'first', x: 72, y: 0, hp: 1000 }
  const second = { id: 'second', x: 104, y: 0, hp: 1000 }
  scene.enemies = [primary, first, second]

  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)

  assert.equal(lightning.length, 3)
  assert.equal(lightning[0].from, scene.localPlayer.state)
  assert.equal(lightning[0].to, primary)
  assert.equal(lightning[1].from, primary)
  assert.equal(lightning[1].to, first)
  assert.equal(lightning[2].from, first)
  assert.equal(lightning[2].to, second)
})

test('weapon signatures use the explicitly supplied PlayerEntity instead of localPlayer', () => {
  const player = new PlayerEntity({
    id: 'remote',
    state: staffState('weapon.remote_staff', 'storm_palm', 180, 40),
  })
  const { scene, runtime, hits, lightning } = signatureScene('arcane_burst', player)
  const primary = { id: 'primary', x: 220, y: 40, hp: 1000 }
  scene.enemies = [primary]

  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)

  assert.ok(hits.length > 0)
  assert.ok(hits.every((hit) => hit.attacker === player))
  assert.equal(lightning[0]?.from, player.state)
})

test('weapon signature progress is isolated per PlayerEntity', () => {
  const first = new PlayerEntity({
    id: 'first',
    state: staffState('weapon.first_staff', 'storm_palm', 0, 0),
  })
  const second = new PlayerEntity({
    id: 'second',
    state: staffState('weapon.second_staff', 'storm_palm', 20, 0),
  })
  const scene = {
    localPlayer: first,
    enemies: [],
    damageEnemy() {},
    __dungeonVfx: { lightning() {} },
    __dungeonWeaponVfx: { nova() {} },
  }

  const firstRuntime = installDungeonWeaponSignatures(scene, { player: first })
  const secondRuntime = installDungeonWeaponSignatures(scene, { player: second })

  firstRuntime.onStaffHit({ id: 'a', x: 40, y: 0, hp: 100 }, 20)
  firstRuntime.onStaffHit({ id: 'b', x: 40, y: 0, hp: 100 }, 20)
  secondRuntime.onStaffHit({ id: 'c', x: 60, y: 0, hp: 100 }, 20)

  assert.notEqual(firstRuntime, secondRuntime)
  assert.equal(first.runtime.weaponSignatures, firstRuntime)
  assert.equal(second.runtime.weaponSignatures, secondRuntime)
  assert.equal(firstRuntime.progress(), 2)
  assert.equal(secondRuntime.progress(), 1)
  assert.equal(scene.__dungeonWeaponSignatures, firstRuntime)
})
