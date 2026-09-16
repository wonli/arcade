import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLegacyTestPlayer } from './test/player-fixture.js'
import { ensureDungeonCombatRuntime } from './combat-runtime.js'
import { createPlayerEntity } from './player-entity.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'

function weaponState(archetype) {
  return {
    modifiers: {},
    equipment: { weapon: { type: `weapon.test_${archetype}`, archetype, rarity: 'common', damage: 0, affixes: [] } },
  }
}

function sceneFor(archetype) {
  const calls = []
  const scene = attachLegacyTestPlayer({
    playerState: { x: 0, y: 0, damage: 20, hp: 100, maxHp: 100, ...weaponState(archetype) },
    enemies: [],
    events: { once() {} },
    damageEnemy(enemy, damage, critical, knockback, context, player) {
      calls.push({ enemy, damage, knockback, context, player })
      enemy.hp = Math.max(0, Number(enemy.hp) - Number(damage))
    },
    slash(target, player = this.localPlayer) {
      const combat = this.dungeon.combat
      combat.beginWeaponAttack(target, player)
      return combat.damageEnemy(
        target,
        combat.weaponDamageStat(player, player.state.damage),
        false,
        22,
        { direct: true, canProc: true, source: 'weapon' },
        player,
      )
    },
    autoAttack() {},
    trySkill() {},
    applyWeaponProcs() {},
  })
  ensureDungeonCombatRuntime(scene)
  return { scene, calls }
}

function wallBetweenPlayerAndTarget() {
  return { solids: [{ x: 40, y: -22, width: 22, height: 44 }] }
}

function install(scene) {
  const runtime = installDungeonWeaponCombat(scene)
  return { runtime, combat: scene.dungeon.combat }
}

test('attack capability applies archetype damage and knockback without mutating player base damage', () => {
  const dagger = sceneFor('dagger')
  dagger.scene.enemies = [{ hp: 100, x: 80, y: 0 }]
  const daggerCombat = install(dagger.scene).combat
  daggerCombat.attack(dagger.scene.localPlayer, 1000)

  const katana = sceneFor('katana')
  katana.scene.enemies = [{ hp: 100, x: 80, y: 0 }]
  const katanaCombat = install(katana.scene).combat
  katanaCombat.attack(katana.scene.localPlayer, 1000)

  assert.ok(dagger.calls[0].damage < 20)
  assert.ok(dagger.calls[0].knockback < 22)
  assert.ok(katana.calls[0].damage > 20)
  assert.ok(katana.calls[0].knockback > 22)
  assert.equal(dagger.scene.localPlayer.state.damage, 20)
  assert.equal(katana.scene.localPlayer.state.damage, 20)
})

test('attack capability range follows current archetype', () => {
  const dagger = sceneFor('dagger')
  dagger.scene.enemies = [{ hp: 10, x: 150, y: 0 }]
  install(dagger.scene).combat.attack(dagger.scene.localPlayer, 1000)
  assert.equal(dagger.calls.length, 0)

  const katana = sceneFor('katana')
  katana.scene.enemies = [{ hp: 10, x: 190, y: 0 }]
  install(katana.scene).combat.attack(katana.scene.localPlayer, 1000)
  assert.equal(katana.calls.length, 1)
})

test('attack capability skips a closer enemy behind a wall and attacks the nearest visible enemy', () => {
  const { scene, calls } = sceneFor('katana')
  scene.__roomGeometry = wallBetweenPlayerAndTarget()
  scene.enemies = [
    { id: 'blocked', hp: 10, x: 100, y: 0 },
    { id: 'visible', hp: 10, x: 0, y: 150 },
  ]
  const { combat } = install(scene)

  combat.attack(scene.localPlayer, 1000)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].enemy.id, 'visible')
})

test('attack capability preserves PlayerEntity ownership for a remote attacker', () => {
  const { scene, calls } = sceneFor('dagger')
  const remote = createPlayerEntity({
    id: 'remote',
    state: { x: 0, y: 0, damage: 30, hp: 100, maxHp: 100, ...weaponState('katana') },
  })
  scene.enemies = [{ id: 'target', hp: 100, x: 190, y: 0 }]
  const { combat } = install(scene)

  combat.attack(remote, 1000)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].player, remote)
  assert.ok(calls[0].damage > 30)
  assert.equal(remote.lastAttackAt, 1000)
  assert.equal(scene.localPlayer.lastAttackAt, 0)
})

test('weapon policy routes attack and impact vfx to the attacking PlayerEntity', () => {
  const { scene } = sceneFor('sword')
  const localVfx = { attacks: 0, impacts: 0, attack() { this.attacks++ }, impact() { this.impacts++ } }
  const remoteVfx = { attacks: 0, impacts: 0, attack() { this.attacks++ }, impact() { this.impacts++ } }
  scene.localPlayer.runtime.weaponVfx = localVfx
  scene.__dungeonWeaponVfx = localVfx
  const remote = createPlayerEntity({
    id: 'remote',
    state: { x: 0, y: 0, damage: 30, hp: 100, maxHp: 100, ...weaponState('sword') },
  })
  remote.runtime.weaponVfx = remoteVfx
  scene.enemies = [{ id: 'target', hp: 100, x: 80, y: 0 }]
  const { combat } = install(scene)

  combat.attack(remote, 1000)

  assert.equal(remoteVfx.attacks, 1)
  assert.equal(remoteVfx.impacts, 1)
  assert.equal(localVfx.attacks, 0)
  assert.equal(localVfx.impacts, 0)
})

test('runtime exposes current auto attack range', () => {
  const { scene } = sceneFor('katana')
  assert.equal(install(scene).runtime.range(), 196)
})
