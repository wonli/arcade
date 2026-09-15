import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayerEntity } from './player-entity.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'

function sceneFor(archetype) {
  const calls = []
  const scene = {
    playerState: { x: 0, y: 0, damage: 20, hp: 100, maxHp: 100, effects: {}, equippedWeapon: { archetype } },
    enemies: [], lastAttackAt: 0, events: { once() {} },
    damageEnemy(enemy, damage, critical, knockback, context, player) { calls.push({ enemy, damage, knockback, context, player }) },
    slash(target, player = this.localPlayer) { this.damageEnemy(target, player.state.damage, false, 22, { direct: true, source: 'weapon' }, player) },
    autoAttack() {},
  }
  return { scene, calls }
}

function wallBetweenPlayerAndTarget() {
  return { solids: [{ x: 40, y: -22, width: 22, height: 44 }] }
}

test('direct slash applies archetype damage and knockback then restores player state', () => {
  const dagger = sceneFor('dagger'); installDungeonWeaponCombat(attachLegacyTestPlayer(dagger.scene)); dagger.scene.slash({ hp: 10 })
  const katana = sceneFor('katana'); installDungeonWeaponCombat(attachLegacyTestPlayer(katana.scene)); katana.scene.slash({ hp: 10 })
  assert.ok(dagger.calls[0].damage < 20); assert.ok(dagger.calls[0].knockback < 22); assert.ok(katana.calls[0].damage > 20); assert.ok(katana.calls[0].knockback > 22)
  assert.equal(dagger.scene.localPlayer.state.damage, 20); assert.equal(katana.scene.localPlayer.state.damage, 20)
})

test('auto attack range follows current archetype', () => {
  const dagger = sceneFor('dagger'); dagger.scene.enemies = [{ hp: 10, x: 150, y: 0 }]; installDungeonWeaponCombat(attachLegacyTestPlayer(dagger.scene)); dagger.scene.autoAttack(1000); assert.equal(dagger.calls.length, 0)
  const katana = sceneFor('katana'); katana.scene.enemies = [{ hp: 10, x: 190, y: 0 }]; installDungeonWeaponCombat(attachLegacyTestPlayer(katana.scene)); katana.scene.autoAttack(1000); assert.equal(katana.calls.length, 1)
})

test('auto attack skips a closer enemy behind a wall and attacks the nearest visible enemy', () => {
  const { scene, calls } = sceneFor('katana')
  scene.__roomGeometry = wallBetweenPlayerAndTarget()
  scene.enemies = [
    { id: 'blocked', hp: 10, x: 100, y: 0 },
    { id: 'visible', hp: 10, x: 0, y: 150 },
  ]
  installDungeonWeaponCombat(attachLegacyTestPlayer(scene))

  scene.autoAttack(1000)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].enemy.id, 'visible')
})

test('direct melee slash cannot damage an enemy through solid room geometry', () => {
  const { scene, calls } = sceneFor('sword')
  scene.__roomGeometry = wallBetweenPlayerAndTarget()
  installDungeonWeaponCombat(attachLegacyTestPlayer(scene))

  scene.slash({ id: 'blocked', hp: 10, x: 100, y: 0 })

  assert.equal(calls.length, 0)
})

test('runtime keeps auto attack and damage owned by the provided PlayerEntity', () => {
  const { scene, calls } = sceneFor('dagger')
  attachLegacyTestPlayer(scene)
  const remote = createPlayerEntity({
    id: 'remote',
    state: { x: 0, y: 0, damage: 30, hp: 100, maxHp: 100, effects: {}, equippedWeapon: { archetype: 'katana' } },
  })
  scene.enemies = [{ id: 'target', hp: 10, x: 190, y: 0 }]
  installDungeonWeaponCombat(scene)

  scene.autoAttack(1000, remote)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].player, remote)
  assert.ok(calls[0].damage > 30)
  assert.equal(remote.lastAttackAt, 1000)
  assert.equal(scene.localPlayer.lastAttackAt, 0)
})

test('runtime exposes current auto attack range', () => { const { scene } = sceneFor('katana'); assert.equal(installDungeonWeaponCombat(attachLegacyTestPlayer(scene)).range(), 196) })